import { App } from './App';
import { onDeviceDictation } from './dictation/on-device';
import { machineOnThePhone } from './machine-store';
import type { MiddlemanAt } from './middleman/client';
import { httpMiddleman, type Fetching, type Socketing } from './middleman/http';
import { thePhone } from './phone';

const fetching: Fetching = (url, options) => fetch(url, options);

const socketing: Socketing = (url, heard) => {
  const socket = new WebSocket(url);
  socket.onopen = () => {
    heard.opened();
  };
  socket.onmessage = (event: { data: unknown }) => {
    heard.received(String(event.data));
  };
  socket.onerror = () => {
    heard.closed('the connection to the machine failed');
  };
  socket.onclose = () => {
    heard.closed('the connection to the machine closed');
  };
  return {
    send: (text) => {
      socket.send(text);
    },
    close: () => {
      socket.close();
    },
  };
};

const middleman: MiddlemanAt = (machine) => httpMiddleman(machine, fetching, socketing);

const machines = machineOnThePhone();

const dictation = onDeviceDictation();

const phone = thePhone();

export function Viu(): React.JSX.Element {
  return (
    <App middleman={middleman} machines={machines} dictation={dictation} phone={phone} />
  );
}
