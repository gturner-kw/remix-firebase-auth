# Remix Firebase Auth POC

## App Setup

Create the `.env` file and define the following variables:

COOKIE_SECRET=super-secret-value-here
HOST_URL=<http://localhost:3000>

Create a Firebase account, grab the client config json, and paste it into a file named: `firebaseConfig.json`

```json
{
  "apiKey": "xxx",
  "authDomain": "xxx",
  "projectId": "xxx",
  "storageBucket": "xxx",
  "messagingSenderId": "xxx",
  "appId": "xxx"
}
```

Then grab the firebase admin service account key json and paste it into a file named: `serviceAccountKey.json`

```json
{
  "type": "xxx",
  "project_id": "xxx",
  "private_key_id": "xxx",
  "private_key": "xxx",
  "client_email": "xxx",
  "client_id": "xxx",
  "auth_uri": "xxx",
  "token_uri": "xxx",
  "auth_provider_x509_cert_url": "xxx",
  "client_x509_cert_url": "xxx"
}
```

## Development

From your terminal:

```sh
npm run dev
```

This starts your app in development mode, rebuilding assets on file changes.

## Fly Setup

1. [Install `flyctl`](https://fly.io/docs/getting-started/installing-flyctl/)

1. Sign up and log in to Fly

```sh
flyctl auth signup
```

1. Setup Fly. It might ask if you want to deploy, say no since you haven't built the app yet.

```sh
flyctl launch
```

## Deployment

If you've followed the setup instructions already, all you need to do is run this:

```sh
npm run deploy
```

You can run `flyctl info` to get the url and ip address of your server.

Check out the [fly docs](https://fly.io/docs/getting-started/node/) for more information.

## Auth Strategy

We'll reduce auth checks and database load by expressing session tokens as signed cookies.

* Session tokens should be signed to ensure they haven't been tampered with.
* Session tokens should be valid for only 30 minutes.
* User accounts should be verfied enabled at least every 30 minutes.
* If the user has not logged out, they will be able to recreate a session within 7 days of inactivity.
* Activity means having the web page open but doesn't require active user input.
* User will be required to login at least every 30 days.

Keep firebase client logged in. Firebase tokens expire after 1 hour. The client will submit the token to the server for verification, and the server will issue the session token as a signed httponly cookie with a 30 minute expiry so that both client and server can authenticate/authorize access.

### Implementation

Client submits firebase token to server, which creates the following cookies:

* session - a signed httponly 30 minute cookie
* refresh - a signed httponly 7 day cookie used to authorize refreshing session
* login - a signed httponly permanent cookie that marks when the user last logged in to assist in enforcing the 30 day login rule

This method will utilize cookie expiry to manage various timeouts.
