import { createApi } from './api.js';
import { referencePeople, referenceCharacter, referenceSeat } from './reference-model.js';

// One session object shared with the reference component file. It is created
// before that file is imported, because it reads this object once at load time.
export const SESSION = {
  api: createApi(),
  current: null,
  users: [],
  floor: 1,
  mode: 'inline',
  referencePeople,
  referenceSeat,
  characterFor: referenceCharacter,
};
