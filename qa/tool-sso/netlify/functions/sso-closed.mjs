import {settings} from '../../runtime/settings.mjs';
import {createEntry} from '../../runtime/entry.mjs';
export default createEntry({settings});
export const config={path:['/api/tool-sso/*','/api/adsengine/*']};
