export const enum ListKind {
	Nil,
	Cons,
}

export type List<T> = { kind: ListKind.Nil } | { kind: ListKind.Cons; head: T; tail: List<T> };
export const empty: List<never> = { kind: ListKind.Nil };
export const isEmpty = <T>(list: List<T>): list is { kind: ListKind.Nil } => list.kind === ListKind.Nil;
export const cons = <T>(head: T, list: List<T>): List<T> => ({ kind: ListKind.Cons, head, tail: list });
export const pop = <T>(list: List<T>): [T, List<T>] => {
	if (list.kind === ListKind.Nil) {
		throw new Error("Pop from empty list");
	}
	return [list.head, list.tail];
};
