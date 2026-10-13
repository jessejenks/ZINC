import * as ast from "./core";

export type Binder = ast.Abstraction | ast.LetIn;

export type Names = Map<Binder, string>;

export function freshName(scope: readonly (string | null)[], name: string): string {
	while (scope.includes(name)) name += "'";
	return name;
}
