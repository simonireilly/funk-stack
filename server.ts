import { createRequestHandler } from "@remix-vendor/cdk";
import * as build from "@remix-run/dev/server-build";
import { captureHTTPsGlobal, captureAWS } from "aws-xray-sdk";

if (process.env.NODE_ENV !== "production") {
  require("./mocks");
}

if (process.env.NODE_ENV === "production") {
  captureHTTPsGlobal(require("https"));
  captureAWS(require("aws-sdk"));
}

export const handler = createRequestHandler({
  build,
  mode: process.env.NODE_ENV,
});
