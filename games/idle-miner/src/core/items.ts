// Item kinds are numbers: planet * 10 + form. Forms 5..9 are crates of forms 0..4.

export const kindOf = (planet: number, form: number) => planet * 10 + form;
export const planetOfKind = (k: number) => Math.floor(k / 10);
export const formOfKind = (k: number) => k % 10;
export const isCrate = (k: number) => k % 10 >= 5;
