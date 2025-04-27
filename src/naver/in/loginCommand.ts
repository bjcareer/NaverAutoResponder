export class LoginCommand {
    constructor(
        private readonly _username: string,
        private readonly _password: string,
    ) {
    }


    get username(): string {
        return this._username;
    }

    get password(): string {
        return this._password;
    }
}
