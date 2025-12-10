export async function generateKeyPair() {
  return crypto.subtle.generateKey(
    { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: "SHA-256" },
    true,
    ["encrypt", "decrypt"]
  )
}

export async function encryptAES(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encData = await crypto.subtle.encrypt({ name:"AES-GCM", iv }, key, new TextEncoder().encode(data))
  return { encData, iv }
}

export async function decryptAES(key, encData, iv) {
  const decrypted = await crypto.subtle.decrypt({ name:"AES-GCM", iv }, key, encData)
  return new TextDecoder().decode(decrypted)
}

export async function importPublicKey(rawKey) {
  return crypto.subtle.importKey("spki", rawKey, { name:"RSA-OAEP", hash:"SHA-256" }, true, ["encrypt"])
}

export async function importPrivateKey(rawKey) {
  return crypto.subtle.importKey("pkcs8", rawKey, { name:"RSA-OAEP", hash:"SHA-256" }, true, ["decrypt"])
}

export async function encryptKeyRSA(publicKey, key) {
  return crypto.subtle.encrypt({ name:"RSA-OAEP" }, publicKey, key)
}

export async function decryptKeyRSA(privateKey, encryptedKey) {
  return crypto.subtle.decrypt({ name:"RSA-OAEP" }, privateKey, encryptedKey)
}
