export type Category = {
  id: number;
  name: string;
  ordering: number;
};

export type Editor = {
  id: number;
  name: string;
};

export type Item = {
  id: number;
  name: string;
  isAvailable: boolean;
  isPlayable: boolean;
  isBuyable: boolean;
  updateDate: string;
  bookType: "G" | "L" | "F" | "E" | null;
  notBuyableType: string | null;
  editor: Editor;
  category: Category;
  idBgg: number | null;
};

export type Vote = {
  id: { idItem: number; date: string };
};
