import {LoginCommand} from "../in/loginCommand";


export class LoginService {
    constructor() {
    }


    async login(command: LoginCommand): Promise<void> {
        console.log(`Logging in with username: ${command.username} and password: ${command.password}`);
    }
}
