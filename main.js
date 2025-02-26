
var EDITOR = false; 

if (!crypto.subtle) {
    [ alert, x => { throw new Error(x) } ].forEach(f => f("Can't decrypt diary entries. Please visit the https version of this website, incase you are on the http version, else switch to a modern browser that supports WebCrypto (baseline 2015)."));
}

var encryptedWriteKey = null;

new Array(document.getElementsByTagName("input")).filter(i => i.type == "checkbox").forEach(i => i.removeAttribute("checked"));

function hideLoader() {
    document.getElementById("loader").classList.add("hidden");
}

function showLoader() {
    document.getElementById("loader").classList.remove("hidden");
}

async function encrypt(key, input) {
    
    const keyData = new TextEncoder().encode(key);
    const keyHash = await crypto.subtle.digest("SHA-256", keyData);

    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyHash,
        { name: "AES-CTR" },
        false,
        [ "encrypt" ]
    );

    const iv = crypto.getRandomValues(new Uint8Array(16));

    const data = new TextEncoder().encode(input);

    const ciphertext = await crypto.subtle.encrypt(
        {
            name: "AES-CTR",
            counter: iv,
            length: 128
        },
        cryptoKey,
        data
    );

    const result = new Uint8Array(iv.length + ciphertext.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(ciphertext), iv.length);

    return String.fromCharCode(...new Uint8Array(result.buffer));

}

async function decrypt(key, encrypted) {

    const encryptedData = new ArrayBuffer(encrypted.length);
    const view = new Uint8Array(encryptedData);
    for (let i = 0; i < encrypted.length; i++) {
        view[i] = encrypted.charCodeAt(i);
    }

    const iv = new Uint8Array(encryptedData, 0, 16);
    const ciphertext = new Uint8Array(encryptedData, 16);

    const keyData = new TextEncoder().encode(key);
    const keyHash = await crypto.subtle.digest("SHA-256", keyData);

    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyHash,
        { name: "AES-CTR" },
        false,
        [ "decrypt" ]
    );

    const decrypted = await crypto.subtle.decrypt(
        {
            name: "AES-CTR",
            counter: iv,
            length: 128
        },
        cryptoKey,
        ciphertext
    );

    return new TextDecoder().decode(decrypted);

}

async function verifyEditor(pass) {
    return (await fetch("https://api.github.com/gists/819dd14b5ce6510b950b0ff7fbfa2119", {
        method: "GET",
        headers: { Authorization: `token ${await decrypt(pass, encryptedWriteKey)}`, accept: "application/vnd.github+json" }
    })).status == 200;
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
var editorKey = null;

var newEntryDate = null;

async function _uploadData(data, gistId, encryptedKey, fileName) {
    return (await fetch(`https://api.github.com/gists/${gistId}`, {
        method: "PATCH",
        headers: { Authorization: `token ${await decrypt(editorKey, encryptedKey)}`, accept: "application/vnd.github+json" },
        body: JSON.stringify({ files: { [ fileName ]: { content: data } } })
    })).status;
}

async function uploadData(data) {
    return await _uploadData(await encrypt(key, data), "819dd14b5ce6510b950b0ff7fbfa2119", encryptedWriteKey, "private-entries.bin");
}

async function uploadChangedEditorKey(data) {
    return await _uploadData(await encrypt(editorKey, data), "e57c1ee5f7d07e6f5f2c5cd9d23876e9", encryptedWriteKey, "private-entries-editor-key.bin");
}

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
    uploadData(JSON.stringify(entries));
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
    uploadData(JSON.stringify(entries));
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

        uploadData(JSON.stringify(entries));

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

async function load(password, asEditor, editorPassword) {

    var button = document.getElementById("enter-button");

    showLoader();

    try {
        
        if (asEditor) {

            encryptedWriteKey = JSON.parse(await (await fetch("https://api.github.com/gists/e57c1ee5f7d07e6f5f2c5cd9d23876e9", { 
                cache: "no-store"
            })).text()).files["private-entries-editor-key.bin"].content;

            if (!await verifyEditor(editorPassword)) {
                throw new Error("wrong editor password");
            } else {
                editorKey = editorPassword;
                EDITOR = true;
                Cookies.set("iseditor", true, { expires: 1 });
                Cookies.set("editorkey", btoa(editorKey), { expires: 1 });
            }

        }

        var data = JSON.parse(await (await fetch("https://api.github.com/gists/819dd14b5ce6510b950b0ff7fbfa2119", { 
            cache: "no-store" 
        })).text()).files["private-entries.bin"].content;

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
        
        Cookies.set("key", btoa(key), { expires: 1 });

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
    if (EDITOR) {
        document.getElementById("options").style.display = "block";
    } else {
        document.getElementById("non-editor-options").style.display = "block";
    }
    hideLoader();

}

function showLoginScreen() {
    document.getElementById("entries").innerHTML = "";
    document.getElementById("pass-popup").style.display = "";
    document.getElementById("options").style.display = "none";
    document.getElementById("non-editor-options").style.display = "none";
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

function showEditorPasswordChangeDialogue() {
    document.getElementById("change-editor-pass-dialogue").classList.toggle("hidden");
}

async function changePassword(oldPass, newPass) {
    showLoader();
    var old = key;
    key = newPass;
    if (oldPass == old && await uploadData(JSON.stringify(entries)) == 200) {
        document.getElementById("change-pass-dialogue").classList.add("hidden");
    } else {
        key = old;
        document.getElementById("change-pass-confirm").innerHTML = "[failed...]";
        setTimeout(() => {
            document.getElementById("change-pass-confirm").innerHTML = "Change";
        }, 1000);
    }
    hideLoader();
}

async function changeEditorPassword(oldPass, newPass) {
    showLoader();
    var old = editorKey;
    editorKey = newPass;
    var dec = await decrypt(oldPass, encryptedWriteKey);
    encryptedWriteKey = await encrypt(editorKey, dec);
    if (oldPass == old && (await uploadChangedEditorKey(dec)) == 200) {
        document.getElementById("change-editor-pass-dialogue").classList.add("hidden");
    } else {
        editorKey = old;
        document.getElementById("change-editor-pass-confirm").innerHTML = "[failed...]";
        setTimeout(() => {
            document.getElementById("change-editor-pass-confirm").innerHTML = "Change";
        }, 1000);
    }
    hideLoader();
}

if (Cookies.get("key")) {
    load(atob(Cookies.get("key")), Cookies.get("iseditor"), atob(Cookies.get("editorkey") ?? ""));
}