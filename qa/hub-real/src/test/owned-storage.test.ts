import {it,expect,vi} from 'vitest';
import {brokeredPreviewStorage} from '../integrations/supabase/previewAuthStorage';
it('uses owned origin storage without editor messaging',()=>{
  const post=vi.spyOn(window,'postMessage');expect(brokeredPreviewStorage()).toBe(window.localStorage);expect(post).not.toHaveBeenCalled();post.mockRestore();
});
