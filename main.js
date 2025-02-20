
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

function createEntry(content, date) {

    var div = document.createElement("div");
    var dateP = document.createElement("p");
    var contentP = document.createElement("p");

    div.className = "entry";
    dateP.className = "date";
    contentP.className = "content";

    dateP.innerHTML = date;
    contentP.innerHTML = content.replaceAll("\n", "<br>");

    div.appendChild(dateP);
    div.appendChild(contentP);
    document.getElementById("entries").appendChild(div);

}  

async function load(password) {

    var data;

    try {

        data = await (await fetch("https://raw.githubusercontent.com/davidsaltacc/private-entries/main/data.bin")).text();
        data = JSON.parse(await decrypt(password, data));
        
        data.forEach(entry => createEntry(entry.content, new Date(entry.date).toLocaleString("en-US", {
            timeZone: "Europe/Berlin", // i live in the gmt+1 timezone
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
        })));

    } catch (err) { 
        
        var button = document.getElementById("enter-button");
        button.innerHTML = "[failed...]";
        setTimeout(() => {
            button.innerHTML = "Enter";
        }, 1000);

        console.error(err); 

        return; 
    }

    document.getElementById("pass-popup").style.display = "none";

}
