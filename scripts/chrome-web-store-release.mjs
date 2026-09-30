import { createSign } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifestPath = join(root, "manifest.json");
const packageJsonPath = join(root, "package.json");
const packageLockPath = join(root, "package-lock.json");

const command = process.argv[2];

if (!command) {
  throw new Error(
    "Missing command. Use one of: check-uploadable, sync-version, upload, publish.",
  );
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const packageLock = JSON.parse(readFileSync(packageLockPath, "utf8"));

const tokenUrl = "https://oauth2.googleapis.com/token";
const apiBaseUrl = "https://chromewebstore.googleapis.com/v2";
const uploadBaseUrl = "https://chromewebstore.googleapis.com/upload/v2";
const chromeWebStoreScope = "https://www.googleapis.com/auth/chromewebstore";

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parseServiceAccountCredentials() {
  const rawValue = requireEnv("CWS_SERVICE_ACCOUNT_JSON").trim();

  try {
    return JSON.parse(rawValue);
  } catch {
    try {
      const decodedValue = Buffer.from(rawValue, "base64").toString("utf8");
      return JSON.parse(decodedValue);
    } catch {
      throw new Error(
        "CWS_SERVICE_ACCOUNT_JSON is not valid JSON. Store either the full service account JSON or its base64-encoded contents.",
      );
    }
  }
}

function parseVersion(version) {
  if (!/^\d+(?:\.\d+){0,3}$/.test(version)) {
    throw new Error(`Unsupported version format: ${version}`);
  }

  return version.split(".").map((segment) => Number.parseInt(segment, 10));
}

function compareVersions(left, right) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;

    if (leftValue !== rightValue) {
      return leftValue > rightValue ? 1 : -1;
    }
  }

  return 0;
}

function incrementPatch(version) {
  const parts = parseVersion(version);
  parts[parts.length - 1] += 1;
  return parts.join(".");
}

function getHighestVersion(versions) {
  return versions.reduce((highest, version) => {
    if (!highest || compareVersions(version, highest) > 0) {
      return version;
    }

    return highest;
  }, null);
}

function updateVersionFiles(version) {
  let changed = false;

  if (manifest.version !== version) {
    manifest.version = version;
    changed = true;
  }

  if (packageJson.version !== version) {
    packageJson.version = version;
    changed = true;
  }

  if (packageLock.version !== version) {
    packageLock.version = version;
    changed = true;
  }

  if (packageLock.packages?.[""]?.version !== version) {
    packageLock.packages[""].version = version;
    changed = true;
  }

  if (!changed) {
    return false;
  }

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  writeFileSync(packageLockPath, `${JSON.stringify(packageLock, null, 2)}\n`);
  return true;
}

function setGithubOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }

  writeFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, {
    flag: "a",
  });
}

async function fetchAccessToken() {
  const credentials = parseServiceAccountCredentials();
  const clientEmail = credentials.client_email;
  const privateKey = credentials.private_key;

  if (!clientEmail || !privateKey) {
    throw new Error(
      "CWS_SERVICE_ACCOUNT_JSON must include client_email and private_key fields",
    );
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 3600;
  const jwtHeader = {
    alg: "RS256",
    typ: "JWT",
  };
  const jwtClaimSet = {
    iss: clientEmail,
    scope: chromeWebStoreScope,
    aud: tokenUrl,
    exp: expiresAt,
    iat: issuedAt,
  };
  const encodedHeader = Buffer.from(JSON.stringify(jwtHeader)).toString(
    "base64url",
  );
  const encodedClaimSet = Buffer.from(JSON.stringify(jwtClaimSet)).toString(
    "base64url",
  );
  const unsignedToken = `${encodedHeader}.${encodedClaimSet}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign(privateKey).toString("base64url");
  const assertion = `${unsignedToken}.${signature}`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Google OAuth token request failed (${response.status}): ${text}`,
    );
  }

  const payload = await response.json();

  if (!payload.access_token) {
    throw new Error("Google OAuth token response did not include access_token");
  }

  return payload.access_token;
}

function isNotUpdateableResponse(text) {
  let payload;

  try {
    payload = JSON.parse(text);
  } catch {
    return false;
  }

  return payload?.error?.details?.some(
    (detail) => detail?.reason === "NOT_UPDATEABLE",
  );
}

function formatCwsError(responseStatus, path, text) {
  if (isNotUpdateableResponse(text)) {
    return (
      `Chrome Web Store rejected the request because the item cannot be edited right now ` +
      `(HTTP ${responseStatus} for ${path}). A version is likely already in review from a ` +
      `previous workflow run.\nAPI response: ${text}`
    );
  }

  return `Chrome Web Store request failed (${responseStatus}) for ${path}: ${text}`;
}

async function cwsRequest(path, init = {}) {
  const publisherId = requireEnv("CWS_PUBLISHER_ID");
  const itemId = requireEnv("CWS_EXTENSION_ID");
  const accessToken = await fetchAccessToken();
  const resolvedPath = path
    .replaceAll("{publisherId}", encodeURIComponent(publisherId))
    .replaceAll("{itemId}", encodeURIComponent(itemId));
  const response = await fetch(
    resolvedPath.startsWith("http")
      ? resolvedPath
      : `${apiBaseUrl}${resolvedPath}`,
    {
      ...init,
      headers: {
        authorization: `Bearer ${accessToken}`,
        ...init.headers,
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(formatCwsError(response.status, path, text));
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function extractVersionsFromChannels(channels = []) {
  return channels
    .map((channel) => channel?.crxVersion)
    .filter((version) => typeof version === "string" && version.length > 0);
}

async function fetchStatus() {
  return cwsRequest("/publishers/{publisherId}/items/{itemId}:fetchStatus");
}

function describeSubmittedRevision(status) {
  const submitted = status.submittedItemRevisionStatus;

  if (!submitted) {
    return null;
  }

  const versions = extractVersionsFromChannels(submitted.distributionChannels);

  return {
    state: submitted.state,
    versions,
  };
}

function getReleaseBlocker(status) {
  const submitted = describeSubmittedRevision(status);

  if (submitted?.state === "PENDING_REVIEW") {
    const versions =
      submitted.versions.length > 0 ? submitted.versions.join(", ") : "unknown";
    return {
      code: "PENDING_REVIEW",
      versions: submitted.versions,
      message:
        `Version ${versions} is already pending review in the Chrome Web Store. ` +
        `Skipping upload and publish for this run. ` +
        `If you re-ran this workflow after a successful upload, no action is needed—` +
        `wait for Google's review to finish, then run again to release a newer version.`,
    };
  }

  if (status.lastAsyncUploadState === "IN_PROGRESS") {
    return {
      code: "UPLOAD_IN_PROGRESS",
      versions: [],
      message:
        "Chrome Web Store is still processing a package upload from a recent run. " +
        "Skipping upload and publish for this run. Wait a few minutes and re-run only " +
        "if the previous upload did not finish.",
    };
  }

  return null;
}

function logReleaseSkip(phase, message) {
  console.log("");
  console.log(`[${phase}] Skipped — ${message}`);
  console.log("");
}

function setReleaseSkipOutputs(blocker) {
  setGithubOutput("store_blocked", "true");
  setGithubOutput("store_block_code", blocker.code);
  setGithubOutput("store_block_reason", blocker.message);
  setGithubOutput("uploaded", "false");
  setGithubOutput("published", "false");
}

function setReleaseActiveOutputs() {
  setGithubOutput("store_blocked", "false");
  setGithubOutput("store_block_code", "");
  setGithubOutput("store_block_reason", "");
}

async function checkUploadable() {
  const status = await fetchStatus();
  const submitted = describeSubmittedRevision(status);
  const blocker = getReleaseBlocker(status);

  if (submitted) {
    console.log(`Submitted revision state: ${submitted.state}`);
    console.log(
      `Submitted version(s): ${submitted.versions.join(", ") || "none"}`,
    );
  } else {
    console.log("No submitted revision waiting to publish.");
  }

  if (status.lastAsyncUploadState) {
    console.log(`Last async upload state: ${status.lastAsyncUploadState}`);
  }

  if (blocker) {
    logReleaseSkip("check", blocker.message);
    setReleaseSkipOutputs(blocker);
    return;
  }

  setReleaseActiveOutputs();
  console.log("Chrome Web Store item is ready for a new upload.");
}

async function syncVersion() {
  const status = await fetchStatus();
  const blocker = getReleaseBlocker(status);
  const publishedVersions = extractVersionsFromChannels(
    status.publishedItemRevisionStatus?.distributionChannels,
  );
  const submittedVersions = extractVersionsFromChannels(
    status.submittedItemRevisionStatus?.distributionChannels,
  );
  const highestStoreVersion = getHighestVersion([
    ...publishedVersions,
    ...submittedVersions,
  ]);
  const localVersion = manifest.version;
  const pendingReviewVersion =
    blocker?.code === "PENDING_REVIEW"
      ? getHighestVersion(blocker.versions)
      : null;
  const nextStoreVersion = highestStoreVersion
    ? incrementPatch(highestStoreVersion)
    : null;
  const targetVersion = pendingReviewVersion
    ? pendingReviewVersion
    : nextStoreVersion && compareVersions(nextStoreVersion, localVersion) > 0
      ? nextStoreVersion
      : localVersion;
  const changed = updateVersionFiles(targetVersion);

  console.log(`Local version: ${localVersion}`);
  console.log(`Highest store version: ${highestStoreVersion ?? "none"}`);
  console.log(`Target version: ${targetVersion}`);
  console.log(
    changed ? "Updated version files." : "Version files already aligned.",
  );

  if (blocker) {
    logReleaseSkip("sync-version", blocker.message);
    setReleaseSkipOutputs(blocker);
  } else {
    setReleaseActiveOutputs();
  }

  setGithubOutput("local_version", localVersion);
  setGithubOutput("store_version", highestStoreVersion ?? "");
  setGithubOutput("version", targetVersion);
  setGithubOutput("changed", changed ? "true" : "false");
}

async function uploadPackage() {
  const zipPath = process.argv[3];

  if (!zipPath) {
    throw new Error("Missing zip path. Usage: upload <zip-path>");
  }

  const status = await fetchStatus();
  const blocker = getReleaseBlocker(status);

  if (blocker) {
    logReleaseSkip("upload", blocker.message);
    setGithubOutput("uploaded", "false");
    return;
  }

  const zipBuffer = readFileSync(zipPath);
  const uploadPath = `${uploadBaseUrl}/publishers/{publisherId}/items/{itemId}:upload`;
  const publisherId = requireEnv("CWS_PUBLISHER_ID");
  const itemId = requireEnv("CWS_EXTENSION_ID");
  const accessToken = await fetchAccessToken();
  const resolvedPath = uploadPath
    .replaceAll("{publisherId}", encodeURIComponent(publisherId))
    .replaceAll("{itemId}", encodeURIComponent(itemId));
  const response = await fetch(resolvedPath, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/zip",
    },
    body: zipBuffer,
  });

  if (!response.ok) {
    const text = await response.text();

    if (isNotUpdateableResponse(text)) {
      const message =
        "Chrome Web Store would not accept a new upload because a version is already in review. " +
        "Skipping upload for this run. If you ran this workflow twice, the first run already " +
        "submitted the package—wait for review to finish before trying again.";
      logReleaseSkip("upload", message);
      setGithubOutput("uploaded", "false");
      return;
    }

    throw new Error(formatCwsError(response.status, uploadPath, text));
  }

  const payload = response.status === 204 ? null : await response.json();
  console.log(JSON.stringify(payload, null, 2));
  setGithubOutput("uploaded", "true");
}

async function publishPackage() {
  const publishTarget = (process.argv[3] ?? "default").toLowerCase();
  const publishTypeMap = {
    default: "DEFAULT_PUBLISH",
    staged: "STAGED_PUBLISH",
  };
  const publishType = publishTypeMap[publishTarget];

  if (!publishType) {
    throw new Error("Unsupported publish target. Use one of: default, staged.");
  }

  const blocker = getReleaseBlocker(await fetchStatus());

  if (blocker) {
    logReleaseSkip("publish", blocker.message);
    setGithubOutput("published", "false");
    return;
  }

  const response = await cwsRequest(
    "/publishers/{publisherId}/items/{itemId}:publish",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ publishType }),
    },
  );

  console.log(JSON.stringify(response, null, 2));
  setGithubOutput("published", "true");
}

if (command === "check-uploadable") {
  await checkUploadable();
} else if (command === "sync-version") {
  await syncVersion();
} else if (command === "upload") {
  await uploadPackage();
} else if (command === "publish") {
  await publishPackage();
} else {
  throw new Error(`Unsupported command: ${command}`);
}
