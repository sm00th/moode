var client = {
    id: null,
    secret: null,
    redirect_url: null,
    local_storage: "spotifyToken",
};

async function getToken() {
    const token_string = localStorage.getItem(client.local_storage);
    var token = null;

    client.id = SESSION.json["spotifyclientid"];
    client.secret = SESSION.json["spotifyclientsecret"];
    client.redirect_url = SESSION.json["spotifyredirecturl"];

    if (token_string) {
        token = JSON.parse(token_string);
    }

    if (!token || !token.access) {
        redirectToAuthCodeFlow(client);
    } else if (token.expires < Date.now()) {
        console.log("access token expired");
        if (!token.refresh) {
            console.log("no refresh token, do auth");
            redirectToAuthCodeFlow(client);
        } else {
            token = await refreshToken(client, token);
            localStorage.setItem(client.local_storage, JSON.stringify(token));
        }
    }

    if (token && token.access) {
        return token;
    }

    console.error("auth failed");
    return null;
}

async function redirectToAuthCodeFlow(client) {
    if (!client.id || !client.secret || !client.redirect_url) {
        return;
    }

    const state = generateRandomString(16); // FIXME: Can get this somwhere else?

    sessionStorage.setItem("state", state);
    sessionStorage.setItem("spotifyClient", JSON.stringify(client));

    const params = new URLSearchParams();

    params.append("client_id", client.id);
    params.append("response_type", "code");
    params.append("redirect_uri", client.redirect_url);
    params.append("state", state);
    params.append("scope", "user-read-playback-state");

    document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function generateRandomString(length) {
    let text = "";
    let possible =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function spotifyGetMetadata() {
    const metadata_root = document.createElement("div");
    let token = await getToken();
    if (token) {
        let playback_state = await fetchPlaybackState(token.access);
        if (playback_state) {
            const coverart = playback_state.item.album.images[0];
            if (coverart) {
                const coverart_img = new Image(coverart.height, coverart.width);
                coverart_img.src = coverart.url;
                metadata_root.appendChild(coverart_img);
            }
            const metadata = document.createElement("div");
            metadata.innerText =
                playback_state.item.artists[0].name +
                " - " +
                playback_state.item.name +
                " (" +
                playback_state.item.album.name +
                ")";
            metadata_root.appendChild(metadata);
        }
    }
    return metadata_root;
}

async function getAccessToken(client, code) {
    const params = new URLSearchParams();
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", client.redirect_url);

    const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: "Basic " + btoa(client.id + ":" + client.secret),
        },
        body: params,
    });

    const { access_token, expires_in, refresh_token } = await result.json();
    const token = {
        access: access_token,
        expires: Date.now() + expires_in * 1000,
        refresh: refresh_token,
    };
    return token;
}

async function refreshToken(client, token) {
    const params = new URLSearchParams();
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", token.refresh);

    const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: "Basic " + btoa(client.id + ":" + client.secret),
        },
        body: params,
    });

    const { access_token, expires_in, refresh_token } = await result.json();
    const new_token = {
        access: access_token,
        expires: Date.now() + expires_in * 1000,
        refresh: refresh_token ? refresh_token : token.refresh,
    };

    console.log("refreshed token: " + JSON.stringify(new_token));
    return new_token;
}

async function fetchPlaybackState(access_token) {
    const result = await fetch("https://api.spotify.com/v1/me/player", {
        method: "GET",
        headers: { Authorization: `Bearer ${access_token}` },
    });

    if (result.status != 200) {
        return null;
    }

    return await result.json();
}
