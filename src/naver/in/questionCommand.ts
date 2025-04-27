export class QuestionCommand {
    constructor(private readonly _query: string) {
    }

    get query(): string {
        return this._query;
    }
}
