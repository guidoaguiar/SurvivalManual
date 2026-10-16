import { act, renderHook } from '@testing-library/react-native';
import * as Speech from 'expo-speech';
import { useReadAloud } from '@/reader/useReadAloud';
import type { Block } from '@/types/content';

const p = (value: string): Block => ({ type: 'paragraph', children: [{ type: 'text', value }] });
const blocks: Block[] = [p('one'), { type: 'thematicBreak' }, p('two')];
const speak = Speech.speak as jest.Mock;
const finishCurrent = () => act(() => speak.mock.calls[speak.mock.calls.length - 1][1].onDone());

beforeEach(() => jest.clearAllMocks());

it('speaks block by block, skipping empty blocks', () => {
  const { result } = renderHook(() => useReadAloud(blocks, 1.25));
  act(() => result.current.speakFrom(0));
  expect(speak).toHaveBeenLastCalledWith('one', expect.objectContaining({ rate: 1.25, language: 'en' }));
  expect(result.current.speaking).toBe(0);
  finishCurrent();
  expect(speak).toHaveBeenLastCalledWith('two', expect.anything());
  expect(result.current.speaking).toBe(2);
  finishCurrent();
  expect(result.current.speaking).toBeNull();
});

it('stop cancels and ignores late callbacks', () => {
  const { result } = renderHook(() => useReadAloud(blocks, 1));
  act(() => result.current.speakFrom(0));
  act(() => result.current.stop());
  expect(Speech.stop).toHaveBeenCalled();
  finishCurrent();
  expect(speak).toHaveBeenCalledTimes(1);
  expect(result.current.speaking).toBeNull();
});
