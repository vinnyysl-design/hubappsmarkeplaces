import {it,expect,vi} from "vitest";
import {render,screen,cleanup,fireEvent} from "@testing-library/react";
const h=vi.hoisted(()=>({normalImports:0,qaImports:0}));
vi.mock("../OrdinaryApp",()=>{h.normalImports++;return {default:()=> <p>ordinary-only</p>};});
vi.mock("../pages/QaIdentityEntry",()=>{h.qaImports++;return {default:()=> <p>identity-only</p>};});
import App from "../App";
it("QA routes never import normal app; ordinary route remains separate",async()=>{
 vi.stubGlobal("location",{pathname:"/qa-tools"});render(<App/>);await screen.findByText("identity-only");expect(h.normalImports).toBe(0);cleanup();
 vi.stubGlobal("location",{pathname:"/qa-auth"});render(<App/>);await screen.findByText("identity-only");expect(h.normalImports).toBe(0);cleanup();
 vi.stubGlobal("location",{pathname:"/"});render(<App/>);await screen.findByText("ordinary-only");expect(h.normalImports).toBe(1);cleanup();vi.unstubAllGlobals();
});

it("QA popstate never switches to ordinary auth in the same document",async()=>{vi.stubGlobal("location",{pathname:"/qa-tools"});render(<App/>);await screen.findByText("identity-only");vi.stubGlobal("location",{pathname:"/"});fireEvent(window,new PopStateEvent("popstate"));await screen.findByText("Execucao encerrada por navegacao. Nao reinicie o teste.");expect(screen.queryByText("ordinary-only")).toBeNull();cleanup();vi.unstubAllGlobals();});
