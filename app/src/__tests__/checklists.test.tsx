import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import ChecklistScreen from '@/app/tools/checklist';
import ChecklistsScreen from '@/app/tools/checklists';
import { useChecklists } from '@/store/checklists';

const routes = { _layout: () => <Stack />, 'tools/checklists': ChecklistsScreen, 'tools/checklist': ChecklistScreen };

beforeEach(() => useChecklists.setState(useChecklists.getInitialState(), true));

it('creates a list from a template and ticks, adds and resets items', () => {
  renderRouter(routes, { initialUrl: '/tools/checklists' });
  expect(screen.getByText('No lists yet.')).toBeVisible();
  fireEvent.press(screen.getByText('New list'));
  fireEvent.press(screen.getByText('Survival kit'));
  expect(screen).toHavePathname('/tools/checklist');
  const list = useChecklists.getState().lists[0];
  expect(list.templateId).toBe('kit');
  fireEvent.press(screen.getAllByRole('checkbox')[0]);
  expect(useChecklists.getState().lists[0].items[0].done).toBe(true);
  fireEvent.changeText(screen.getByTestId('new-item'), 'Spare socks');
  fireEvent(screen.getByTestId('new-item'), 'submitEditing');
  expect(useChecklists.getState().lists[0].items.at(-1)?.text).toBe('Spare socks');
  fireEvent.press(screen.getByText('Untick all'));
  expect(useChecklists.getState().lists[0].items.every((i) => !i.done)).toBe(true);
});

it('needs two taps to delete a list', () => {
  const id = useChecklists.getState().create('Mine', ['a']);
  renderRouter(routes, { initialUrl: `/tools/checklist?id=${id}` });
  fireEvent.press(screen.getByText('Delete list'));
  expect(useChecklists.getState().lists).toHaveLength(1);
  fireEvent.press(screen.getByText('Tap again to delete'));
  expect(useChecklists.getState().lists).toHaveLength(0);
});

it('shows not found for an unknown list id', () => {
  renderRouter(routes, { initialUrl: '/tools/checklist?id=nope' });
  expect(screen.getByText('List not found')).toBeVisible();
});
