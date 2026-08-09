import { App } from './App';
import { machineOnThePhone } from './machine-store';
import { httpMiddleman } from './middleman/http';

const machines = machineOnThePhone();

export function Viu(): React.JSX.Element {
  return <App reach={httpMiddleman} machines={machines} />;
}
