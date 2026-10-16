import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { useKeepAwake } from 'expo-keep-awake';
import EmergencyCardScreen from '@/app/tools/emergency-card';
import { useEmergency } from '@/store/emergency';

const routes = { _layout: () => <Stack />, 'tools/emergency-card': EmergencyCardScreen };

beforeEach(() => useEmergency.setState(useEmergency.getInitialState(), true));

it('saves fields and contacts as you type and shows the rescuer view', () => {
  renderRouter(routes, { initialUrl: '/tools/emergency-card' });
  expect(screen.getByText('Stored only on this device. Never uploaded.')).toBeVisible();
  expect(screen.getByText('Show to rescuer')).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText('Blood type'), 'O-');
  fireEvent.press(screen.getByText('Add contact'));
  fireEvent.changeText(screen.getByLabelText('Contact name'), 'Ana');
  fireEvent.changeText(screen.getByLabelText('Phone'), '+351 900 000 000');
  expect(useEmergency.getState().card).toMatchObject({ bloodType: 'O-', contacts: [{ name: 'Ana', phone: '+351 900 000 000' }] });
  fireEvent.press(screen.getByText('Show to rescuer'));
  expect(screen.getByText('EMERGENCY INFORMATION')).toBeVisible();
  expect(screen.getByText('O-')).toBeVisible();
  expect(useKeepAwake).toHaveBeenCalled();
});
