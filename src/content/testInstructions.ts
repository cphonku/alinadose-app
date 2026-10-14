import type { SampleType } from '../domain/models';

/**
 * PLACEHOLDER instructions. The biosensor's physical design is not final;
 * update these (and the capture screen) once the wet lab has a test format.
 */
export const TEST_INSTRUCTIONS: Record<SampleType, readonly { title: string; detail: string }[]> = {
  saliva: [
    { title: 'Collect your sample', detail: 'Do not eat or drink for 30 minutes. Fill the collection tube with saliva up to the line.' },
    { title: 'Add it to the test', detail: 'Drip the saliva into the sample well of the Alinadose test.' },
    { title: 'Wait 10 minutes', detail: 'Leave the test on a flat surface while the reaction develops.' },
    { title: 'Take a photo', detail: 'Press Next and photograph the test window in good light.' },
  ],
  urine: [
    { title: 'Collect your sample', detail: 'Use your first morning urine and collect it in the cup.' },
    { title: 'Add it to the test', detail: 'Dip the test strip into the sample up to the arrows for 10 seconds.' },
    { title: 'Wait 10 minutes', detail: 'Leave the test on a flat surface while the reaction develops.' },
    { title: 'Take a photo', detail: 'Press Next and photograph the test window in good light.' },
  ],
};
