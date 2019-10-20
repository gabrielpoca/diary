import React, { useContext } from "react";
import { Route } from "react-router-dom";

import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import ListItemText from "@material-ui/core/ListItemText";
import ListSubheader from "@material-ui/core/ListSubheader";
import SwitchInput from "@material-ui/core/Switch";
import AlarmIcon from "@material-ui/icons/AccessAlarm";
import Container from "@material-ui/core/Container";

import { DBContext } from "../core/Database";
import Navbar from "./Navbar";
import { RemindersToggle } from "./Reminders";

function GeolocationToggle() {
  const { db } = useContext(DBContext);
  const geolocation = db.settings.useSetting("journalGeolocation");

  const toggleGeolocation = async () => {
    if (!geolocation)
      return await db.settings.insert({
        id: "journalGeolocation",
        value: "enabled"
      });

    if (geolocation.value === "enabled")
      return geolocation.update({
        $set: {
          value: "disabled"
        }
      });

    try {
      new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });

      return geolocation.update({
        $set: {
          value: "enabled"
        }
      });
    } catch (e) {
      console.error(e);
      return geolocation.update({
        $set: {
          value: "disabled"
        }
      });
    }
  };

  if (geolocation === undefined || !navigator.geolocation) return null;

  return (
    <ListItem disableGutters>
      <ListItemIcon>
        <AlarmIcon />
      </ListItemIcon>
      <ListItemText primary="Capture GPS location for entriess" />
      <ListItemSecondaryAction>
        <SwitchInput
          onChange={toggleGeolocation}
          checked={geolocation && geolocation.value === "enabled"}
        />
      </ListItemSecondaryAction>
    </ListItem>
  );
}

function Dashboard() {
  return (
    <>
      <Navbar />
      <Container maxWidth="md">
        <List
          subheader={<ListSubheader disableGutters>Settings</ListSubheader>}
        >
          <RemindersToggle />
        </List>
        <List
          subheader={<ListSubheader disableGutters>Geolocation</ListSubheader>}
        >
          <GeolocationToggle />
        </List>
      </Container>
    </>
  );
}

export default ({ match }) => (
  <Route path={`${match.path}/`} component={Dashboard} />
);
