import { describe, it, expect } from 'vitest';
import type { Complaint, QueueData } from '@/types';
import {
  createEmptyQueue,
  loadComplaints,
  markFilled,
  markError,
  markSubmitted,
  moveNext,
  movePrev,
  canFill,
  buildStatusUpdate,
  mergeSettings,
  DEFAULT_SETTINGS,
} from './queue';

function makeComplaint(index: number, text = `Жалоба ${index + 1}`): Complaint {
  return {
    index, orgName: `Компания ${index + 1}`, region: '', municipality: '',
    locality: '', street: '', house: '', building: '', apartment: '',
    postalCode: '', appealType: '', appealTopic: '', territorialBody: '',
    structuralUnit: '', fsspEmployee: '', appealText: text,
  };
}

const complaints3 = [makeComplaint(0), makeComplaint(1), makeComplaint(2)];

describe('createEmptyQueue', () => {
  it('returns idle queue with no complaints', () => {
    const q = createEmptyQueue();
    expect(q.state).toBe('idle');
    expect(q.complaints).toEqual([]);
    expect(q.currentIndex).toBe(0);
    expect(q.results).toEqual([]);
  });
});

describe('loadComplaints', () => {
  it('sets state to ready and creates pending results', () => {
    const q = loadComplaints(createEmptyQueue(), complaints3);
    expect(q.state).toBe('ready');
    expect(q.complaints).toHaveLength(3);
    expect(q.currentIndex).toBe(0);
    expect(q.results).toHaveLength(3);
    expect(q.results.every(r => r.status === 'pending')).toBe(true);
  });

  it('resets index when loading new complaints', () => {
    const prev: QueueData = {
      complaints: complaints3, currentIndex: 2,
      results: [], state: 'filling',
    };
    const q = loadComplaints(prev, [makeComplaint(0)]);
    expect(q.currentIndex).toBe(0);
    expect(q.complaints).toHaveLength(1);
  });
});

describe('markFilled', () => {
  it('marks specific index as filled and sets state to filling', () => {
    const q = loadComplaints(createEmptyQueue(), complaints3);
    const updated = markFilled(q, 1);
    expect(updated.results[1].status).toBe('filled');
    expect(updated.results[1].timestamp).toBeTruthy();
    expect(updated.state).toBe('filling');
  });

  it('does not mutate original queue', () => {
    const q = loadComplaints(createEmptyQueue(), complaints3);
    markFilled(q, 0);
    expect(q.results[0].status).toBe('pending');
  });
});

describe('markError', () => {
  it('marks specific index as error with message', () => {
    const q = loadComplaints(createEmptyQueue(), complaints3);
    const updated = markError(q, 0, 'Content script timeout');
    expect(updated.results[0].status).toBe('error');
    expect(updated.results[0].error).toBe('Content script timeout');
  });
});

describe('markSubmitted', () => {
  it('marks current index as submitted', () => {
    const q = loadComplaints(createEmptyQueue(), complaints3);
    const updated = markSubmitted(q);
    expect(updated.results[0].status).toBe('submitted');
  });

  it('sets state to completed when all are submitted or error', () => {
    let q = loadComplaints(createEmptyQueue(), [makeComplaint(0), makeComplaint(1)]);
    q = { ...q, currentIndex: 0 };
    q = markSubmitted(q);
    expect(q.state).not.toBe('completed');

    q = { ...q, currentIndex: 1 };
    q = markSubmitted(q);
    expect(q.state).toBe('completed');
  });

  it('counts errors as done for completion check', () => {
    let q = loadComplaints(createEmptyQueue(), [makeComplaint(0), makeComplaint(1)]);
    q = markError(q, 0, 'fail');
    q = { ...q, currentIndex: 1 };
    q = markSubmitted(q);
    expect(q.state).toBe('completed');
  });

  it('no-ops when currentIndex is out of range', () => {
    const q: QueueData = { complaints: [], currentIndex: 5, results: [], state: 'idle' };
    const updated = markSubmitted(q);
    expect(updated).toBe(q);
  });
});

describe('moveNext / movePrev', () => {
  it('moveNext increments index', () => {
    const q = loadComplaints(createEmptyQueue(), complaints3);
    const next = moveNext(q);
    expect(next?.currentIndex).toBe(1);
  });

  it('moveNext returns null at last item', () => {
    const q = { ...loadComplaints(createEmptyQueue(), complaints3), currentIndex: 2 };
    expect(moveNext(q)).toBeNull();
  });

  it('movePrev decrements index', () => {
    const q = { ...loadComplaints(createEmptyQueue(), complaints3), currentIndex: 2 };
    const prev = movePrev(q);
    expect(prev?.currentIndex).toBe(1);
  });

  it('movePrev returns null at first item', () => {
    const q = loadComplaints(createEmptyQueue(), complaints3);
    expect(movePrev(q)).toBeNull();
  });
});

describe('canFill', () => {
  it('returns true for ready state with complaints', () => {
    const q = loadComplaints(createEmptyQueue(), complaints3);
    expect(canFill(q)).toBe(true);
  });

  it('returns true for filling state', () => {
    let q = loadComplaints(createEmptyQueue(), complaints3);
    q = markFilled(q, 0);
    expect(canFill(q)).toBe(true);
  });

  it('returns false for idle state', () => {
    expect(canFill(createEmptyQueue())).toBe(false);
  });

  it('returns false for completed state', () => {
    let q = loadComplaints(createEmptyQueue(), [makeComplaint(0)]);
    q = markSubmitted(q);
    expect(canFill(q)).toBe(false);
  });
});

describe('buildStatusUpdate', () => {
  it('builds status update message', () => {
    const q = loadComplaints(createEmptyQueue(), complaints3);
    const msg = buildStatusUpdate(q, DEFAULT_SETTINGS);
    expect(msg.type).toBe('STATUS_UPDATE');
    expect(msg.state).toBe('ready');
    expect(msg.total).toBe(3);
    expect(msg.currentIndex).toBe(0);
    expect(msg.settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe('mergeSettings', () => {
  it('merges partial settings', () => {
    const merged = mergeSettings(DEFAULT_SETTINGS, { notifyOnComplete: false });
    expect(merged.notifyOnComplete).toBe(false);
  });

  it('keeps defaults for unspecified fields', () => {
    const merged = mergeSettings(DEFAULT_SETTINGS, {});
    expect(merged).toEqual(DEFAULT_SETTINGS);
  });
});
