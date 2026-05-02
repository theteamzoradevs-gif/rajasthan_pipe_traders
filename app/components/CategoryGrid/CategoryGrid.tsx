import Image from "next/image";
import styles from "./CategoryGrid.module.css";

const categories = [
  { name: "Cable Clips", image: "/Cable_Clip.png" },
  { name: "Nail Clamps", image: "/Nail_Cable_Clip.png" },
  { name: "Concrete Nails", image: "/Nail_Cable_Clip.png" },
  { name: "Dry Wall Screws", image: "/Cable_Clip.png" },
  { name: "Bulb Holders", image: "/Nail_Cable_Clip.png" },
  { name: "Modular Boxes", image: "/Cable_Clip.png" },
  { name: "MCB Boxes", image: "/Nail_Cable_Clip.png" },
  { name: "Cable Ties", image: "/Cable_Clip.png" },
  { name: "Wall Plugs", image: "/Nail_Cable_Clip.png" },
  { name: "Insulation Tape", image: "/Cable_Clip.png" },
];

export default function CategoryGrid() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.grid}>
          {categories.map((cat) => (
            <div key={cat.name} className={styles.item}>
              <div className={styles.iconWrap}>
                <Image
                  src={cat.image}
                  alt={cat.name}
                  width={60}
                  height={60}
                  className={styles.iconImg}
                />
              </div>
              <span className={styles.label}>{cat.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
