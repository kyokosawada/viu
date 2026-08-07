# @viu/middleman

The service that runs on the machine and that Viu talks to. It translates between herdr and Viu and
holds no conversation state of its own - see
[ADR 0004](../docs/adr/0004-middleman-is-stateless.md).

It does nothing yet. Right now it starts, prints the protocol version it was built against, and
exits. Talking to herdr and exposing anything to the phone lands in
[#14](https://github.com/kyokosawada/viu/issues/14).

## Running it locally

From the repo root:

```sh
npm install
npm start
```

`npm start` builds first, then runs it. To do the two steps separately:

```sh
npm run build
node middleman/dist/main.js
```

You should see a single line naming the protocol version and the Node version it is running on.

Node 22 or newer is required; `.nvmrc` pins the version CI uses.

## Checks

Run from the repo root and cover this package - see [Checks](../README.md#checks).
