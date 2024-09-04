import { AirComponent, html, state } from "@air-apps/air-js";

export const HelloWorld = AirComponent("hello-world", ()=>{
    return html`
        <h1>Hello World</h1>
    `
})