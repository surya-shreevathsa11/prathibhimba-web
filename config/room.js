export const rooms = {
  R1: {
    id: "01",
    name: "Silver Oak Haven",
    type: "Room",
    description:
      "A comfortable private room for 2 adults and 1 child, designed for a relaxed and restful stay.",
    price: 3500,
    capacity: {
      minAdults: 1,
      maxAdults: 2,
      maxChildren: 1,
      maxTotal: 3,
    },
  },

  R2: {
    id: "02",
    name: "Rosewood Retreat",
    type: "Room",
    description:
      "A cozy private room ideal for 2 adults and 1 child, offering a calm and easy stay experience.",
    price: 3500,
    capacity: {
      minAdults: 1,
      maxAdults: 2,
      maxChildren: 1,
      maxTotal: 3,
    },
  },

  R3: {
    id: "03",
    name: "Banyan House",
    type: "Dormitory",
    description:
      "A spacious dorm for up to 12 guests, perfect for sharing stories, laughter, and unforgettable memories together.",
    price: 10000,
    capacity: {
      minAdults: 1,
      maxAdults: 7,
      maxChildren: 5,//no limit for kids and adults (total 12)
      maxTotal: 12,
    },
  },

  R4: {
    id: "04",
    name: "Rain Tree Grove",
    type: "Dormitory",
    description:
      "A comfortable dorm for up to 12 guests, made for group stays filled with conversations, bonding, and lasting memories.",
    price: 10000,
    capacity: {
      minAdults: 1,
      maxAdults: 7,
      maxChildren: 5,
      maxTotal: 12,
    },
  },
};
