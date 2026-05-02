import React from "react";
import styles from "./about.module.css";

export const metadata = {
  title: "About Us | Rajasthan Pipe Traders",
  description: "Learn about Rajasthan Pipe Traders - a leading manufacturer and wholesaler of electrical wiring accessories and cable management solutions since 2012.",
};

export default function AboutPage() {
  return (
    <div className={styles.aboutContainer}>
      {/* Hero Section */}
      <section className={styles.heroSection}>
        <div className={styles.heroContent}>
          <h1 className={styles.mainTitle}>About Rajasthan Pipe Traders</h1>
          <p className={styles.tagline}>
            Reliable Solutions for Your Electrical & Hardware Needs
          </p>
        </div>
      </section>

      {/* Main Content */}
      <div className={styles.contentWrapper}>
        {/* Opening Introduction */}
        <section className={styles.section}>
          <p className={styles.introText}>
            When you choose Rajasthan Pipe Traders, you're not just buying products—you're partnering with a company that understands the real challenges of electrical and construction work.
          </p>
          <p className={styles.bodyText}>
            Established in 2012, Rajasthan Pipe Traders has grown into a trusted manufacturer, supplier, and wholesaler of electrical wiring accessories and fastening solutions. Based in Ahmedabad, Gujarat, we proudly serve contractors, electricians, builders, wholesalers, and retailers across India.
          </p>
        </section>

        {/* Our Journey & Commitment */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Our Journey & Commitment</h2>
          <p className={styles.bodyText}>
            What started as a focused trading business has evolved into a dependable name in electrical and hardware accessories. Over the years, we have built our reputation on three core values: quality, consistency, and trust.
          </p>
          <p className={styles.bodyText}>
            Under the guidance of Mr. Lokesh Jain, our goal has always been simple—deliver products that perform reliably in real working conditions while maintaining honest and transparent business practices.
          </p>
        </section>

        {/* What We Offer */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>What We Offer</h2>
          <p className={styles.bodyText}>
            We provide a wide and practical range of products designed to support residential, commercial, and industrial projects. Our product categories include:
          </p>
          <ul className={styles.productList}>
            <li className={styles.listItem}>
              <h3 className={styles.listTitle}>Cable Management Solutions</h3>
              <p>Cable Clips (Single & Double Nail), Nylon Cable Ties, Casing Clips</p>
            </li>
            <li className={styles.listItem}>
              <h3 className={styles.listTitle}>Fastening Products</h3>
              <p>Concrete Nails, Drywall Screws, Wall Plugs (PVC Gitti)</p>
            </li>
            <li className={styles.listItem}>
              <h3 className={styles.listTitle}>Electrical Fittings</h3>
              <p>UPVC & CPVC Pipe Clamps, Modular Boxes, MCB Boxes, Electrical Holders, Plugs, and Sockets</p>
            </li>
            <li className={styles.listItem}>
              <h3 className={styles.listTitle}>General Hardware Accessories</h3>
              <p>Essential installation materials for everyday site requirements</p>
            </li>
          </ul>
          <p className={styles.bodyText}>
            Every product is manufactured using premium-grade raw materials and modern techniques to ensure durability, safety, and long-term performance.
          </p>
        </section>

        {/* Quality Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Quality You Can Depend On</h2>
          <p className={styles.bodyText}>
            We understand that even the smallest components—like clips, nails, or screws—play a critical role in safety and performance. That's why we follow strict quality control measures at every stage, from sourcing raw materials to final packaging.
          </p>
          <p className={styles.bodyText}>
            Our products are designed to handle demanding site conditions and deliver consistent results over time.
          </p>
        </section>

        {/* Built For Your Requirements */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Built for Your Requirements</h2>
          <p className={styles.bodyText}>
            Whether you are managing a small retail requirement or a large-scale project, we are equipped to support you with:
          </p>
          <ul className={styles.simpleList}>
            <li>Bulk order handling with ready stock availability</li>
            <li>Timely delivery through efficient logistics</li>
            <li>Customized solutions based on application and quantity</li>
            <li>Consistent product quality across every order</li>
          </ul>
          <p className={styles.bodyText}>
            Our organized warehouse and supply chain ensure that your materials reach you on time, every time.
          </p>
        </section>

        {/* Industries We Serve */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Industries & Customers We Serve</h2>
          <p className={styles.bodyText}>
            We proudly cater to a wide range of customers and industries, including:
          </p>
          <div className={styles.twoColumnList}>
            <div className={styles.column}>
              <ul className={styles.simpleList}>
                <li>Electrical wholesalers, retailers, and distributors</li>
                <li>Contractors and electricians</li>
                <li>Builders and developers</li>
                <li>Infrastructure and project contractors</li>
                <li>Industrial and panel builders</li>
              </ul>
            </div>
            <div className={styles.column}>
              <p className={styles.columnTitle}>Our products are widely used in:</p>
              <ul className={styles.simpleList}>
                <li>Residential projects</li>
                <li>Commercial buildings</li>
                <li>Industrial installations</li>
                <li>Construction and real estate developments</li>
                <li>Electrical maintenance work</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Why Customers Trust Us */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Why Customers Trust Us</h2>
          <p className={styles.bodyText}>
            Customers across India choose Rajasthan Pipe Traders because we focus on what truly matters to them:
          </p>
          <div className={styles.trustList}>
            <div className={styles.trustItem}>
              <h4 className={styles.trustTitle}>Consistent Quality</h4>
              <p>Products that perform reliably on-site</p>
            </div>
            <div className={styles.trustItem}>
              <h4 className={styles.trustTitle}>Competitive Pricing</h4>
              <p>Fair pricing without compromising standards</p>
            </div>
            <div className={styles.trustItem}>
              <h4 className={styles.trustTitle}>Timely Delivery</h4>
              <p>Keeping your projects on schedule</p>
            </div>
            <div className={styles.trustItem}>
              <h4 className={styles.trustTitle}>Wide Product Range</h4>
              <p>Everything you need, in one place</p>
            </div>
            <div className={styles.trustItem}>
              <h4 className={styles.trustTitle}>Customer Support</h4>
              <p>Responsive and practical assistance</p>
            </div>
          </div>
          <p className={styles.bodyText}>
            We believe in building long-term relationships, not just completing transactions.
          </p>
        </section>

        {/* Our Vision */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Our Vision</h2>
          <p className={styles.bodyText}>
            Our vision is to become one of India's most reliable names in electrical and hardware solutions by continuously improving our products, expanding our reach, and maintaining the highest standards of service and integrity.
          </p>
        </section>

        {/* Message Section */}
        <section className={styles.messageSection}>
          <h2 className={styles.sectionTitle}>A Message to Our Customers</h2>
          <p className={styles.messageText}>
            At Rajasthan Pipe Traders, every product we deliver reflects our commitment to quality and responsibility. We value your trust and aim to provide solutions that make your work easier, safer, and more efficient.
          </p>
          <p className={styles.messageHighlight}>Your success is what drives us forward.</p>
        </section>

        {/* Contact Information */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Contact Information</h2>
          <div className={styles.simpleContactInfo}>
            <p><strong>Registered Office:</strong> House No. C-1, Safal Sumel-10, MH Mills, Near Ambedkar Hall, Saraspur, Ahmedabad - 380018, Gujarat, India</p>
            <p><strong>Business Nature:</strong> Manufacturer & Wholesaler</p>
            <p><strong>Proprietor:</strong> Lokesh Jain</p>
          </div>
        </section>
      </div>
    </div>
  );
}
