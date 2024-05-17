import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import axios from "axios";
import cookieParser from "cookie-parser";
// utils
import randomString from "./utils/random.js";


// app config
const app = express();
const PORT = process.env.PORT || 4000;
const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const redirect_uri = process.env.REDIRECT_URI;
const front_end_uri = process.env.FRONT_URI;

const corsOptions = {
    origin: [process.env.FRONT_URI, process.env.REXP],
    credentials: true,
};
// middlewares
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// XMLHttpRequest from a different domain cannot set cookie values for their own domain unless withCredentials is set to true before making the request.
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", req.headers.origin);
    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
});

// endpoints
app.get('/', (req, res) => {
    res.send('Sup bois.');
});

app.use('/login', (req, res) => {
    const state = randomString(16);
    res.cookie('spotify_auth_key', state);
    // Redirect to spotify login page with required parameters
    const params = new URLSearchParams({
        client_id: client_id,
        response_type: "code",
        redirect_uri: redirect_uri,
        state: state,
        scope: [
            'user-read-private',
            'user-read-playback-state',
            'streaming',
            'user-modify-playback-state',
            'playlist-modify-public',
            'user-library-modify',
            'user-top-read',
            'user-read-currently-playing',
            'playlist-read-private', 'user-follow-read',
            'user-read-recently-played',
            'playlist-modify-private',
            'user-follow-modify',
            'user-library-read',
            'user-read-email'
        ],
        show_dialog: true
    })
    res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

app.use('/callback', async (req, res) => {
    try {
        const code = req.query.code || null;
        const state = req.query.state || null;
        const storedKey = req.cookies ? req.cookies['spotify_auth_key'] : null;
        if (state === null || state !== storedKey) {
            // Redirect to homepage with error status and clear the cookie
            res.redirect(`${front_end_uri}/#${new URLSearchParams({ error: 'invalid_token' })}`)
        } else {
            // auth key not needed anymore since it is to be newly generated every request
            res.clearCookie('spotify_auth_key');
            // Header parameters
            const config = {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: "Basic " + Buffer.from(client_id + ":" + client_secret).toString('base64')
                }
            }
            // Request body parameter
            let options = {
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirect_uri,
            }
            const params = new URLSearchParams(options);
            const { status, data } = await axios.post('https://accounts.spotify.com/api/token', params, config);
            if (status === 200) {
                const { access_token, refresh_token } = data;
                console.log({ token: access_token });
                // store refresh key as cookie 
                res.cookie('refresh_key', refresh_token);
                const params = new URLSearchParams({ accessToken: access_token, refreshToken: refresh_token });
                // Redirect to homepage with access token and refresh token params
                res.redirect(`${front_end_uri}/#${params}`);
            } else {
                // Redirect to homepage with error status and clear the cookie
                res.redirect(`${front_end_uri}/#${new URLSearchParams({ error: 'invalid_token' })}`)
            }
        }
    } catch (error) {
        console.log(error);
    }
});

app.get('/refresh_token', async (req, res) => {
    try {
        const refresh_key = req.cookies.refresh_key;
        // Header parameters
        const config = {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: "Basic " + Buffer.from(client_id + ":" + client_secret).toString('base64')
            }
        }
        // Request body parameters 
        let options = {
            grant_type: 'refresh_token',
            refresh_token: refresh_key,
        }
        const params = new URLSearchParams(options);
        const { status, data } = await axios.post('https://accounts.spotify.com/api/token', params, config);

        if (status === 200) {
            const { access_token } = data;
            res.send({ access_token: access_token });
        }
    } catch (error) {
        console.log(error)
    }
});

app.get('/logout', (req, res) => {
    res.clearCookie('refresh_key');
    res.status(200).send('User logged out');
});

// listeners
app.listen(PORT, () => console.log(`server running on port ${PORT}`));