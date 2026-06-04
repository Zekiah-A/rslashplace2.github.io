"use strict";

/**
 * @typedef {Omit<PublicKeyCredentialDescriptor, "id"> & { id: string }} ServerCredentialDescriptor
 * @typedef {Omit<PublicKeyCredentialUserEntity, "id"> & { id: string }} ServerCredentialUserEntity
 * @typedef {Omit<PublicKeyCredentialRequestOptions, "challenge"|"allowCredentials"> & { challenge: string, allowCredentials?: ServerCredentialDescriptor[] }} ServerCredentialRequestOptions
 * @typedef {Omit<PublicKeyCredentialCreationOptions, "challenge"|"user"|"excludeCredentials"> & { challenge: string, user: ServerCredentialUserEntity, excludeCredentials?: ServerCredentialDescriptor[] }} ServerCredentialCreationOptions
 */

/**
 * @param {string} value
 * @returns {ArrayBuffer}
 */
function base64UrlToBuffer(value) {
	if (typeof value !== "string") {
		throw new Error("Invalid passkey challenge");
	}

	const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}

/**
 * @param {ArrayBuffer|ArrayBufferView} value
 * @returns {string}
 */
function bufferToBase64Url(value) {
	const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer);
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
}

/**
 * @param {ServerCredentialRequestOptions} options
 * @returns {PublicKeyCredentialRequestOptions}
 */
function credentialRequestOptions(options) {
	return {
		...options,
		challenge: base64UrlToBuffer(options.challenge),
		allowCredentials: options.allowCredentials?.map(credential => ({
			...credential,
			id: base64UrlToBuffer(credential.id)
		}))
	};
}

/**
 * @param {ServerCredentialCreationOptions} options
 * @returns {PublicKeyCredentialCreationOptions}
 */
function credentialCreationOptions(options) {
	return {
		...options,
		challenge: base64UrlToBuffer(options.challenge),
		user: {
			...options.user,
			id: base64UrlToBuffer(options.user.id)
		},
		excludeCredentials: options.excludeCredentials?.map(credential => ({
			...credential,
			id: base64UrlToBuffer(credential.id)
		}))
	};
}

/**
 * @param {PublicKeyCredential} credential
 */
function serialiseAttestationResponse(credential) {
	const response = /**@type {AuthenticatorAttestationResponse}*/(credential.response);
	return {
		id: credential.id,
		rawId: bufferToBase64Url(credential.rawId),
		type: credential.type,
		response: {
			attestationObject: bufferToBase64Url(response.attestationObject),
			clientDataJSON: bufferToBase64Url(response.clientDataJSON),
			transports: typeof response.getTransports === "function" ? response.getTransports() : undefined
		},
		clientExtensionResults: credential.getClientExtensionResults()
	};
}

/**
 * @param {PublicKeyCredential} credential
 */
function serialiseAssertionResponse(credential) {
	const response = /**@type {AuthenticatorAssertionResponse}*/(credential.response);
	return {
		id: credential.id,
		rawId: bufferToBase64Url(credential.rawId),
		type: credential.type,
		response: {
			authenticatorData: bufferToBase64Url(response.authenticatorData),
			clientDataJSON: bufferToBase64Url(response.clientDataJSON),
			signature: bufferToBase64Url(response.signature),
			userHandle: response.userHandle ? bufferToBase64Url(response.userHandle) : null
		},
		clientExtensionResults: credential.getClientExtensionResults()
	};
}

/**
 * @param {string} serverUrl
 * @param {string} path
 * @param {RequestInit} [options]
 */
async function passkeyFetch(serverUrl, path, options = {}) {
	const response = await fetch(`${serverUrl}${path}`, {
		credentials: "include",
		...options,
		headers: {
			"Content-Type": "application/json",
			...(/**@type {Record<string, string>}*/(options.headers || {}))
		}
	});
	const body = await response.json().catch(() => null);
	if (!response.ok) {
		throw new Error(body?.error || body?.message || "Passkey request failed");
	}
	return body;
}

export function supportsPasskeys() {
	return Boolean(
		window.PublicKeyCredential &&
		navigator.credentials &&
		typeof navigator.credentials.create === "function" &&
		typeof navigator.credentials.get === "function"
	);
}

/**
 * @param {string} serverUrl
 */
export async function getPasskeyStatus(serverUrl) {
	return await passkeyFetch(serverUrl, "/passkeys/status", {
		method: "GET"
	});
}

/**
 * @param {string} serverUrl
 */
export async function registerPasskey(serverUrl) {
	const options = await passkeyFetch(serverUrl, "/passkeys/register/options", {
		method: "POST",
		body: "{}"
	});
	const credential = await navigator.credentials.create({
		publicKey: credentialCreationOptions(options)
	});
	if (!(credential instanceof PublicKeyCredential)) {
		throw new Error("Passkey registration was cancelled");
	}
	return await passkeyFetch(serverUrl, "/passkeys/register/verify", {
		method: "POST",
		body: JSON.stringify(serialiseAttestationResponse(credential))
	});
}

/**
 * @param {string} serverUrl
 */
export async function authenticatePasskey(serverUrl) {
	const options = await passkeyFetch(serverUrl, "/passkeys/authenticate/options", {
		method: "POST",
		body: "{}"
	});
	const credential = await navigator.credentials.get({
		publicKey: credentialRequestOptions(options)
	});
	if (!(credential instanceof PublicKeyCredential)) {
		throw new Error("Passkey authentication was cancelled");
	}
	return await passkeyFetch(serverUrl, "/passkeys/authenticate/verify", {
		method: "POST",
		body: JSON.stringify(serialiseAssertionResponse(credential))
	});
}
