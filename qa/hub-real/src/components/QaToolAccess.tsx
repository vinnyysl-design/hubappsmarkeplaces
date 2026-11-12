import {useAuth} from "@/contexts/AuthContext";
import {QaToolAccessCore} from "./QaToolAccessCore";
import type {QaApp} from "@/lib/qa-tool-bridge";
export default function QaToolAccess({app}:{app:QaApp}) {
 const auth=useAuth();return <QaToolAccessCore app={app} identity={{...auth,accountStatus:auth.status}}/>;
}
