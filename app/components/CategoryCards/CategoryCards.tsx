import Image from "next/image";
import styles from "./CategoryCards.module.css";

const cards = [
  { title: "Cable Clips & Clamps", image: "/one.png" },
  { title: "Electrical Accessories", image: "/one.png" },
  { title: "Fasteners & Hardware", image: "/one.png" },
];

export default function CategoryCards() {
  return (
    <section className={styles.section}>
      <div className={styles.grid}>
        {cards.map((card) => (
          <div key={card.title} className={styles.card}>
            <Image
              src={card.image}
              alt={card.title}
              fill
              className={styles.cardImage}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
