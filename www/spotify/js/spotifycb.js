const params = new URLSearchParams(window.location.search);
const code = params.get("code");
const state = params.get("state");

if (code) {
    const local_state = sessionStorage.getItem("state");
    const client_string = sessionStorage.getItem("spotifyClient");
    var client = null;

    if (client_string) {
         client = JSON.parse(client_string);

        if (state != local_state) {
            console.log("unexpected state in spotify callback");
        } else {
            sessionStorage.removeItem("state");
            sessionStorage.removeItem("spotifyClient");
            const token = await getAccessToken(client, code);
            localStorage.setItem(client.local_storage, JSON.stringify(token));
        }
    }
}

history.back();
