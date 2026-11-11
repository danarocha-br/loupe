export type Member = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
};

export const members: Member[] = [
  { id: "m1", name: "Ana Souza", email: "ana@example.com", role: "admin" },
  { id: "m2", name: "Bruno Lima", email: "bruno@example.com", role: "member" },
  { id: "m3", name: "Carla Dias", email: "carla@example.com", role: "member" },
  { id: "m4", name: "Diego Alves", email: "diego@example.com", role: "member" },
];
