import localForage from "localforage";

const ab2str = buf => {
  return String.fromCharCode.apply(null, new Uint8Array(buf));
};

const str2ab = str => {
  var buf = new ArrayBuffer(str.length); // 2 bytes for each char
  var bufView = new Uint8Array(buf);
  for (var i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
};

export const setup = async (email, password) => {
  if (await localForage.getItem("encryptionKey"))
    throw new Error("encryption is already setup");

  const inputKey = await crypto.subtle.importKey(
    "raw",
    str2ab(password + email),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: { name: "SHA-256" },
      iterations: 1000,
      salt: str2ab(email)
    },
    inputKey,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );

  await localForage.setItem("encryptionKey", key);
  return await localForage.setItem("email", email);
};

export const destroy = async () => {
  await localForage.setItem("encryptionKey", false);
  return await localForage.setItem("email", false);
};

export const encrypt = async data => {
  return ab2str(
    await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: str2ab(await localForage.getItem("email"))
      },
      await localForage.getItem("encryptionKey"),
      str2ab(data)
    )
  );
};

export const decrypt = async data => {
  return ab2str(
    await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: str2ab(await localForage.getItem("email"))
      },
      await localForage.getItem("encryptionKey"),
      str2ab(data)
    )
  );
};

export const enabled = async () => {
  return !!(await localForage.getItem("encryptionKey"));
};
