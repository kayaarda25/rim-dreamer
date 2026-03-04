import rim1 from "@/assets/rim-1.jpg";
import rim2 from "@/assets/rim-2.jpg";
import rim3 from "@/assets/rim-3.jpg";
import rim4 from "@/assets/rim-4.jpg";
import rim5 from "@/assets/rim-5.jpg";
import rim6 from "@/assets/rim-6.jpg";

export interface Rim {
  id: string;
  name: string;
  brand: string;
  size: number;
  color: string;
  price: number;
  image: string;
}

export const rims: Rim[] = [
  { id: "1", name: "Shadow V5", brand: "Vossen", size: 20, color: "black", price: 1299, image: rim1 },
  { id: "2", name: "Meridian S12", brand: "HRE", size: 19, color: "silver", price: 1899, image: rim2 },
  { id: "3", name: "Luxe Mesh GT", brand: "Rotiform", size: 21, color: "bronze", price: 1599, image: rim3 },
  { id: "4", name: "Concave RS", brand: "BBS", size: 20, color: "black", price: 2199, image: rim4 },
  { id: "5", name: "Turbo Fan", brand: "OZ Racing", size: 18, color: "silver", price: 899, image: rim5 },
  { id: "6", name: "Forged Mono", brand: "ADV.1", size: 22, color: "chrome", price: 2899, image: rim6 },
  { id: "7", name: "Classic 5", brand: "Vossen", size: 17, color: "silver", price: 799, image: rim2 },
  { id: "8", name: "Deep Dish X", brand: "Rotiform", size: 19, color: "black", price: 1399, image: rim1 },
  { id: "9", name: "Bronze Flow", brand: "HRE", size: 20, color: "bronze", price: 2099, image: rim3 },
];

export const brands = [...new Set(rims.map(r => r.brand))];
export const sizes = [17, 18, 19, 20, 21, 22];
export const colors = ["black", "silver", "chrome", "bronze"];
