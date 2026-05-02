'use client';

import React, { useState } from "react";
import { MapPin, UserRound, PhoneCall } from "lucide-react";
import styles from "./contact.module.css";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    city: "",
    comment: ""
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailBody = `Name: ${formData.name}\nEmail: ${formData.email}\nPhone: ${formData.phone}\nCity: ${formData.city}\n\nMessage:\n${formData.comment}`;
    const mailtoLink = `mailto:chetan.mutha9@gmail.com?subject=New Contact Form Submission from ${encodeURIComponent(formData.name)}&body=${encodeURIComponent(emailBody)}`;
    
    window.location.href = mailtoLink;
  };

  return (
    <div className={styles.contactContainer}>
      {/* Hero Section */}
      <section className={styles.heroSection}>
        <div className={styles.heroContent}>
          <h1 className={styles.mainTitle}>Contact Us</h1>
          <p className={styles.tagline}>
            Direct Support for Wholesale & Bulk Orders
          </p>
        </div>
      </section>

      {/* Main Content */}
      <div className={styles.contentWrapper}>
        {/* Two Column Layout - Form and Info */}
        <div className={styles.contactLayout}>
          
          {/* Left Column - Contact Form */}
          <section className={styles.formSection}>
            <h2 className={styles.formTitle}>Send us a Message</h2>
            <p className={styles.formSubtitle}>Fill out the form below and we'll get back to you as soon as possible</p>
            
            <form onSubmit={handleSendEmail} className={styles.contactForm}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="name" className={styles.label}>Name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Your name"
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="email" className={styles.label}>Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="your.email@example.com"
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="phone" className={styles.label}>Phone number *</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    placeholder="+91 XXXXX XXXXX"
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="city" className={styles.label}>City</label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="Your city"
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="comment" className={styles.label}>Comment</label>
                <textarea
                  id="comment"
                  name="comment"
                  value={formData.comment}
                  onChange={handleInputChange}
                  placeholder="Tell us about your inquiry..."
                  rows={5}
                  className={styles.textarea}
                />
              </div>

              <div className={styles.buttonGroup}>
                <button type="submit" className={styles.sendButton}>
                  Send
                </button>
                <a href="tel:08047844816" className={styles.callButton}>
                  Call Us
                </a>
              </div>
            </form>
          </section>

          {/* Right Column - Address Info */}
          <section className={styles.infoSection}>
            <div className={styles.contactInfoGrid}>
              {/* Address Card */}
              <div className={styles.infoCard}>
                <div className={styles.infoCardIcon}>
                  <MapPin aria-hidden />
                </div>
                <h3 className={styles.infoCardTitle}>Location</h3>
                <h4 className={styles.infoCardCompany}>Rajasthan Pipe Traders</h4>
                <p className={styles.infoCardText}>SARASPUR, Ahmedabad - 380018, Gujarat, India</p>
              </div>

              {/* Proprietor Card */}
              <div className={styles.infoCard}>
                <div className={styles.infoCardIcon}>
                  <UserRound aria-hidden />
                </div>
                <h3 className={styles.infoCardTitle}>CEO</h3>
                <p className={styles.infoCardText}>CHETAN JAIN</p>
              </div>

              {/* Call Card */}
              <div className={styles.infoCard}>
                <div className={styles.infoCardIcon}>
                  <PhoneCall aria-hidden />
                </div>
                <h3 className={styles.infoCardTitle}>Call</h3>
                <a href="tel:08047844816" className={styles.infoCardPhone}>
                  08047844816
                </a>
              </div>
            </div>
          </section>

        </div>

        
      </div>
    </div>
  );
}
