import { __decorate } from "tslib";
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
let App = class App {
};
App = __decorate([
    Component({
        selector: 'app-root',
        imports: [RouterOutlet, RouterLink, RouterLinkActive],
        templateUrl: './app.html',
        styleUrl: './app.scss'
    })
], App);
export { App };
