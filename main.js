
const EDITOR = window.location.port == 31457; 

if (!EDITOR) {
    document.getElementById("options").style.display = "none";
}

function hideLoader() {
    document.getElementById("loader").classList.add("hidden");
}

function showLoader() {
    document.getElementById("loader").classList.remove("hidden");
}

function createEntryInUI(content, date, id, prepend) {

    var div = document.createElement("div");
    var dateP = document.createElement("p");
    var contentP = document.createElement("p");
    var editSpan = document.createElement("span");
    var removeSpan = document.createElement("span");

    div.className = "entry";
    dateP.className = "date";
    contentP.className = "content";
    editSpan.className = "entry-action";
    removeSpan.className = "entry-action";

    dateP.innerHTML = `${date} `;
    contentP.innerHTML = content.replaceAll("\n", "<br>");
    editSpan.innerHTML = "[Edit] ";
    removeSpan.innerHTML = "[Remove] ";

    if (EDITOR) {
        dateP.appendChild(editSpan);
        dateP.appendChild(removeSpan);
    }
    div.appendChild(dateP);
    div.appendChild(contentP);
    document.getElementById("entries")[prepend ? "prepend" : "appendChild"](div);

    removeSpan.onclick = () => {
        removeEntry(id, div);
    };

    editSpan.onclick = () => {
        startEditEntry(id, div);
    };

} 

var entries = null;
var key = null;

var newEntryDate = null;

async function uploadNewEntry(content, date) {
    showLoader();
    var id = 0;
    var usedIds = new Set(entries.map(item => item.id));
    while (usedIds.has(id)) {
        id++;
    }
    content = content.trim();
    entries.unshift({
        date: date.toISOString(),
        content: content,
        id: id
    });
    await fetch("/upload", { 
        headers: { 
            "key": key,
            "Accept": "application/json",
            "Content-Type": "application/json"
        }, 
        body: JSON.stringify(entries), 
        method: "post" 
    });
    createEntryInUI(content, date.toLocaleString("en-US", {
        timeZone: "Europe/Berlin",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    }), id, true);
    hideLoader();
}

async function removeEntry(id, uiElement) {
    showLoader();
    entries.splice(entries.indexOf(entries.filter(x => x.id == id)[0]), 1);
    await fetch("/upload", { 
        headers: { 
            "key": key,
            "Accept": "application/json",
            "Content-Type": "application/json"
        }, 
        body: JSON.stringify(entries), 
        method: "post" 
    });
    if (uiElement) {
        uiElement.remove();
    }
    hideLoader();
}

async function startEditEntry(id, uiElement) {

    var textArea = document.createElement("textarea");
    textArea.oninput = () => {
        textArea.style.height = "1px";
        textArea.style.height = `${textArea.scrollHeight}px`;
    };
    textArea.title = "Content";
    textArea.value = entries.filter(x => x.id == id)[0].content;
    textArea.rows = textArea.value.split("\n").length + 1;

    uiElement.getElementsByClassName("content")[0].remove();

    uiElement.appendChild(textArea);

    var saveButton = document.createElement("button");
    saveButton.innerHTML = saveButton.title = "Save";
    saveButton.className = "editing-save-button";

    saveButton.onclick = async () => {

        showLoader();

        entries.filter(x => x.id == id)[0].content = textArea.value;

        await fetch("/upload", { 
            headers: { 
                "key": key,
                "Accept": "application/json",
                "Content-Type": "application/json"
            }, 
            body: JSON.stringify(entries), 
            method: "post" 
        });

        var contentP = document.createElement("p");
        contentP.className = "content";
        contentP.innerHTML = textArea.value.replaceAll("\n", "<br>");

        uiElement.appendChild(contentP);
        saveButton.remove();
        textArea.remove();

        hideLoader();

    };

    uiElement.appendChild(saveButton);

}

async function decrypt(key, encrypted) { 
    
    var encryptedBytes = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest("SHA-256", keyData);

    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        hashBuffer,
        { name: "AES-CTR" },
        false,
        [ "decrypt" ]
    );

    const iv = encryptedBytes.slice(0, 16);
    const ciphertext = encryptedBytes.slice(16);
    
    const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-CTR", counter: iv, length: 64 },
        cryptoKey,
        ciphertext
    );

    return new TextDecoder().decode(decryptedBuffer);
    
}

async function load(password) {

    var button = document.getElementById("enter-button");

    showLoader();

    try {

        var data = await (await fetch(EDITOR ? "/data" : "https://gist.githubusercontent.com/davidsaltacc/819dd14b5ce6510b950b0ff7fbfa2119/raw/e6c65c2f830c574b9557e8eecb876d816fef0076/private-entries.bin", { 
            cache: "no-store" 
        })).text();

        data = JSON.parse(await decrypt(password, data));
        
        data.forEach(entry => createEntryInUI(entry.content, new Date(entry.date).toLocaleString("en-US", {
            timeZone: "Europe/Berlin",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
        }), entry.id));

        entries = data;
        key = password;

    } catch (err) { 
        hideLoader();
        button.innerHTML = "[failed...]";
        setTimeout(() => {
            button.innerHTML = "Enter";
        }, 1000);

        console.error(err); 

        return; 
    }

    document.getElementById("pass-popup").style.display = "none";
    document.getElementById("options").style.display = "block";
    hideLoader();

}

function showEditing() {
    document.getElementById("editing-entry").classList.toggle("hidden");
    newEntryDate = new Date(Date.now());
}

function saveEntry() {
    uploadNewEntry(document.getElementById("editing-content").value, newEntryDate);
    document.getElementById("editing-content").value = "";
    document.getElementById("editing-entry").classList.add("hidden");
}

function showPasswordChangeDialogue() {
    document.getElementById("change-pass-dialogue").classList.toggle("hidden");
}

async function changePassword(oldPass, newPass) {
    showLoader();
    if ((await fetch("/change_password", { 
        headers: { 
            "old_pass": oldPass,
            "new_pass": newPass
        },
        method: "post"
    })).status == 200) {
        document.getElementById("change-pass-dialogue").classList.remove("hidden");;
        key = newPass;
    } else {
        document.getElementById("change-pass-confirm").innerHTML = "[failed...]";
        setTimeout(() => {
            document.getElementById("change-pass-confirm").innerHTML = "Change";
        }, 1000);
    }
    hideLoader();
}