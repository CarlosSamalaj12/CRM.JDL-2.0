export const MOCK_SALONES = [
  "Salon Los Lagos",
  "Salon El Mirador",
  "Terraza Jardines",
  "Salon San Francisco",
  "Jardin Principal"
];

export const MOCK_EVENTS = [
  {
    id: "1",
    name: "Boda Familia Gonzalez",
    date: new Date().toISOString().split('T')[0],
    startTime: "09:00",
    endTime: "14:00",
    status: "Confirmado",
    salon: "Salon Los Lagos",
    pax: 150,
    userId: "u1"
  },
  {
    id: "2",
    name: "Conferencia Tecnica",
    date: new Date().toISOString().split('T')[0],
    startTime: "10:30",
    endTime: "12:30",
    status: "Seguimiento",
    salon: "Salon El Mirador",
    pax: 50,
    userId: "u2"
  },
  {
    id: "3",
    name: "Cena Corporativa",
    date: new Date().toISOString().split('T')[0],
    startTime: "19:00",
    endTime: "22:00",
    status: "Pre reserva",
    salon: "Terraza Jardines",
    pax: 80,
    userId: "u1"
  }
];
