import React from 'react';
import moment from 'moment';
import { withStyles } from '@material-ui/core/styles';

import EntryForm from '../components/EntryForm';
import Navbar from './Navbar';
import { newID } from '../../utils';

import { put } from '../db';

const styles = theme => ({
  root: {
    height: '100%',
    backgroundColor: theme.palette.background.default,
    position: 'fixed',
    width: '100%',
    top: 0,
    left: 0,
  },
});

class NewEntryPage extends React.Component {
  state = {
    body: '',
    date: moment(),
    disabled: false,
    in: true,
  };

  componentWillUnmount() {
    this.setState({ in: false });
  }

  onSave = async () => {
    if (!this.state.body || !this.state.date) return false;

    this.setState({ disabled: true });

    try {
      await put({
        date: this.state.date.toDate(),
        body: this.state.body,
      });

      this.props.history.push('/entries');
    } catch (e) {
      console.error(e);
      this.setState({ disabled: false });
    }
  };

  render() {
    return (
      <div className={this.props.classes.root}>
        <Navbar onSave={this.onSave} />
        <EntryForm onChange={change => this.setState(change)} {...this.state} />
      </div>
    );
  }
}

export default withStyles(styles)(NewEntryPage);
