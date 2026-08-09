import { App } from './App';
import { machineOnThePhone } from './machine-store';
import type { MiddlemanAt } from './middleman/client';
import { httpMiddleman, type Fetching } from './middleman/http';

const fetching: Fetching = (url, options) => fetch(url, options);

const middleman: MiddlemanAt = (machine) => httpMiddleman(machine, fetching);

const machines = machineOnThePhone();

export function Viu(): React.JSX.Element {
  return <App middleman={middleman} machines={machines} />;
}
