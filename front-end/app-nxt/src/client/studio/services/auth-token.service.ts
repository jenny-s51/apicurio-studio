/**
 * @license
 * Copyright 2017 JBoss Inc
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {IAuthenticationService} from "./auth.service";
import {Observable} from "rxjs/Observable";
import {BehaviorSubject} from "rxjs/BehaviorSubject";
import {User} from "../models/user.model";
import {ConfigService} from "./config.service";
import {HttpClient, HttpResponse} from "@angular/common/http";

/**
 * A version of the authentication service that uses token information passed to it
 * when the application loads.  The assumption here is that authentication is handled
 * on the server (for example via OAuth2 web flow).  The server will then pass the
 * token information down into the angular app.
 */
export class TokenAuthenticationService implements IAuthenticationService {

    private _authenticated: BehaviorSubject<boolean> = new BehaviorSubject(false);
    public authenticated: Observable<boolean> = this._authenticated.asObservable();

    private _authenticatedUser: BehaviorSubject<User> = new BehaviorSubject(null);
    public authenticatedUser: Observable<User> = this._authenticatedUser.asObservable();

    private accessToken: string;

    /**
     * Constructor.
     * @param http
     * @param config
     */
    constructor(private http: HttpClient, private config: ConfigService) {
        this.accessToken = config.authToken();

        this._authenticated.next(true);
        this._authenticatedUser.next(config.user());

        let refreshPeriod: number = config.authRefreshPeriod();
        if (refreshPeriod) {
            console.info("[TokenAuthenticationService] Will refresh auth token in %d seconds.", refreshPeriod)
            setTimeout(() => {
                this.refreshToken();
            }, refreshPeriod * 1000);
        } else {
            console.info("[TokenAuthenticationService] No refresh period set. Token may expire unexpectedly!");
        }
    }

    /**
     * Returns the observable for is/isnot authenticated.
     * @return {Observable<boolean>}
     */
    public isAuthenticated(): Observable<boolean> {
        return this.authenticated;
    }

    /**
     * Returns an observable over the currently authenticated User (or null if not logged in).
     * @return {any}
     */
    public getAuthenticatedUser(): Observable<User> {
        return this.authenticatedUser;
    }

    /**
     * Returns the currently authenticated user.
     * @return {User}
     */
    public getAuthenticatedUserNow(): User {
        return this._authenticatedUser.getValue();
    }

    /**
     * Not supported.
     * @param user
     * @param credential
     */
    public login(user: string, credential: any): Promise<User> {
        throw new Error("Not supported.");
    }

    /**
     * Logout.
     */
    public logout(): void {
        window.location.href = this.config.logoutUrl();
    }

    /**
     * Called to inject authentication headers into a remote API call.
     * @param headers
     */
    public injectAuthHeaders(headers: {[header: string]: string}): void {
        let authHeader: string = "bearer " + this.accessToken;
        headers["Authorization"] = authHeader;
    }

    /**
     * Returns the oauth access token.
     * @return {string}
     */
    public getAuthenticationSecret(): string {
        return this.accessToken;
    }

    /**
     * Refreshes the authentication token.
     */
    protected refreshToken(): void {
        let base: string = document.getElementsByTagName("base")[0].href;
        if (base.indexOf("/") == 0) {
            base = location.origin + base;
        }
        let url: string = base + "token";
        let headers: any = { "Accept": "application/json" };
        let options: any = {
            observe: "response",
            headers: new Headers(headers)
        };

        console.info("[TokenAuthenticationService] Refreshing auth token: %s", url);

        this.http.get(url, options).map( event => {
            let response: HttpResponse<any> = <any>event as HttpResponse<any>;
            let auth: any = response.body;
            return auth;
        }).toPromise().then( auth => {
            this.accessToken = auth.token;
            let refreshPeriod: number = auth.tokenRefreshPeriod;
            if (refreshPeriod) {
                console.info("[TokenAuthenticationService] Will refresh auth token in %d seconds.", refreshPeriod)
                setTimeout(() => {
                    this.refreshToken();
                }, refreshPeriod * 1000);
            } else {
                console.info("[TokenAuthenticationService] No refresh period set. Token may expire unexpectedly!");
            }
        }).catch( error => {
            console.info("[TokenAuthenticationService] Error refreshing auth token.  Will try again in 30s.");
            console.info("[TokenAuthenticationService]     %o", error);
            if (error.status === 0) {
                // TODO an error 0 may indicate that the user is logged out
            }
            setTimeout(() => {
                this.refreshToken();
            }, 30 * 1000);
        });
    }

}