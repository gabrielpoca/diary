import React, { useState, useEffect, useContext } from "react";
import RxDB from "rxdb";
import PouchDBIDB from "pouchdb-adapter-idb";
import { format } from "date-fns";
import uuidv1 from "uuid/v1";
import PouchDB from "pouchdb";

import { UserContext } from "./User";
import { EncryptionPassword } from "../account/EncryptionPassword";
import oldDB from "./DB";

const asciiToHex = str => {
  var arr1 = [];
  for (var n = 0, l = str.length; n < l; n++) {
    var hex = Number(str.charCodeAt(n)).toString(16);
    arr1.push(hex);
  }
  return arr1.join("");
};

const baseURL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:5984"
    : "https://couch.gabrielpoca.com";

RxDB.plugin(PouchDBIDB);

export async function setupDB(password) {
  const db = await RxDB.create({
    name: "journal",
    adapter: "idb",
    password
  });

  await db.collection({
    name: "entries",
    schema: {
      title: "entries",
      version: 2,
      type: "object",
      properties: {
        id: {
          type: "string",
          primary: true
        },
        date: {
          type: "string",
          index: true,
          format: "date"
        },
        body: {
          type: "string",
          encrypted: true
        },
        modelType: {
          type: "string",
          final: true,
          default: "journalEntry"
        }
      },
      required: ["id", "date", "body", "modelType"]
    },
    migrationStrategies: {
      1: fn => fn,
      2: fn => fn
    },
    statics: {
      useEntry: id => {
        const [entry, setEntry] = useState();

        useEffect(() => {
          let unmounted = false;

          const query = db.entries.findOne(id);

          const subscription = query.$.subscribe(result => {
            if (unmounted) return;
            if (result) setEntry(result);
            else setEntry([]);
          });

          return () => {
            unmounted = true;
            subscription.unsubscribe();
          };
        }, [id]);

        return entry;
      },
      useEntries: () => {
        const [entries, setEntries] = useState([]);

        useEffect(() => {
          let unmounted = false;

          const query = db.entries.find().sort("date");

          const subscription = query.$.subscribe(result => {
            if (unmounted) return;
            if (result) setEntries(result.reverse());
            else setEntries([]);
          });

          return () => {
            unmounted = true;
            subscription.unsubscribe();
          };
        }, []);

        return entries;
      }
    }
  });

  db.entries.preInsert(newEntryRaw => {
    if (!newEntryRaw.id) newEntryRaw.id = uuidv1();

    if (typeof newEntryRaw.date !== "string")
      newEntryRaw.date = format(newEntryRaw.date, "yyyy-MM-dd");
  }, true);

  db.entries.preSave(newEntryRaw => {
    if (typeof newEntryRaw.date !== "string")
      newEntryRaw.date = format(newEntryRaw.date, "yyyy-MM-dd");
  }, true);

  if (localStorage.getItem("old_to_new") !== "true") {
    const entries = await oldDB.entries.toArray();
    Promise.all(
      entries.map(async ({ id, date, body }) => {
        await db.entries.upsert({ id, date, body, modelType: "journalEntry" });
      })
    );
    localStorage.setItem("old_to_new", "true");
  }

  window.db = db;

  return db;
}

export async function setupSync(db, user) {
  console.log(user);
  const dbName = `${baseURL}/userdb-${asciiToHex(user.name)}`;

  const remoteDB = new PouchDB(dbName, {
    fetch: function(url, opts) {
      opts.headers["X-Auth-CouchDB-UserName"] = user.name;
      opts.headers["X-Auth-CouchDB-Token"] = user.couch_token;
      console.log("sldajldasdkajlskdjakls", opts);
      return PouchDB.fetch(url, opts);
    }
  });

  try {
    await remoteDB.put({
      _id: "_design/journal",
      views: {
        journal: {
          map: `function(doc) {
            if (doc.type === "journalEntry") emit(doc);
          }`
        }
      }
    });
  } catch (e) {
    console.error(e);
  }

  await db.entries.sync({
    remote: remoteDB,
    options: {
      filter: "_view",
      view: "journal"
    }
  });
}

export const DBContext = React.createContext({ db: null, loading: true });

export function DBContextProvider(props) {
  const { user } = useContext(UserContext);
  const [state, setState] = useState({
    db: null,
    loading: true,
    wrongPassword: false
  });

  useEffect(() => {
    (async () => {
      const password = localStorage.getItem("enc_key");

      if (!password) return setState({ loading: false });

      try {
        const db = await setupDB(password);
        setState({ db, loading: false });
      } catch (e) {
        if (e.code === "DB1") {
          setState({ loading: false, wrongPassword: true });
        }

        throw e;
      }
    })();
  }, []);

  useEffect(() => {
    if (!user || !state.db) return;

    setupSync(state.db, user).catch(e => console.error(e));
  }, [user, state.db]);

  const setPassword = async password => {
    console.log(password);
    localStorage.setItem("enc_key", password);

    if (!password) setState({ loading: false });

    try {
      const db = await setupDB(password);
      setState({ db });
    } catch (e) {
      if (e.code === "DB1") {
        setState({ wrongPassword: true });
      }

      throw e;
    }
  };

  if (state.loading) return null;
  if (!state.db)
    return (
      <EncryptionPassword
        wrongPassword={state.wrongPassword}
        onSubmit={setPassword}
      />
    );

  return (
    <DBContext.Provider value={state}>{props.children}</DBContext.Provider>
  );
}