"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './Header.css';
import { useCartWishlist } from '../../context/CartWishlistContext';
import { fetchCategoriesList } from '../../lib/api/client';
import type { ApiCategory } from '../../lib/api/types';
import {
  useStorefrontProductSearch,
  StorefrontProductSearchView,
} from '../StorefrontProductSearch/StorefrontProductSearch';

const Header = () => {
  const pathname = usePathname();
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileCatOpen, setMobileCatOpen] = useState(false);

  useEffect(() => {
    setIsMegaMenuOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);
  const search = useStorefrontProductSearch();
  const { cartCount } = useCartWishlist();
  const [navCategories, setNavCategories] = useState<ApiCategory[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await fetchCategoriesList();
        if (!cancelled) setNavCategories(data);
      } catch {
        if (!cancelled) setNavCategories([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header className="main-header">
      <div className="header-container">
        {/* Logo */}
        <Link href="/" className="logo-section">
          <div className="logo-container">
            <div className="logo-placeholder-graphic">
              <Image
                src="/logo.jpeg"
                alt="Rajasthan Pipe Traders Logo"
                width={150}
                height={50}
                className="main-logo"
                priority
              />
            </div>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="nav-section">
          <div
            className="nav-item has-dropdown"
            onMouseEnter={() => setIsMegaMenuOpen(true)}
            onMouseLeave={() => setIsMegaMenuOpen(false)}
          >
            <span className="nav-link">
              Category
              <svg className={`chevron ${isMegaMenuOpen ? 'open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>

            {isMegaMenuOpen && (
              <div className="mega-menu">
                <div className="mega-menu-inner">
                  <div className="mega-menu-grid">
                    {navCategories.length === 0 ? (
                      <span className="mega-menu-empty">Loading categories…</span>
                    ) : (
                      navCategories.map((cat) => (
                        <Link
                          key={cat._id}
                          href={`/category/${cat.slug}`}
                          className="mega-menu-category-link"
                          onClick={() => setIsMegaMenuOpen(false)}
                        >
                          {cat.name}
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <Link href="/about" className="nav-link">About Us</Link>
          <Link href="/blogs" className="nav-link">Blogs</Link>
          <Link href="/contact" className="nav-link">Contact Us</Link>
        </nav>

        {/* Icons */}
        <div className="header-icons">
         
          <Link href="/cart" className="header-icon-item" aria-label="View cart">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
            </svg>
            {cartCount > 0 && <span className="header-badge">{cartCount}</span>}
          </Link>

          {/* Hamburger — mobile only */}
          <button
            className="hamburger-btn"
            onClick={() => setMobileMenuOpen(o => !o)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            )}
          </button>
        </div>

        {/* Mobile menu overlay */}
        {mobileMenuOpen && (
          <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
            <nav className="mobile-menu" onClick={e => e.stopPropagation()}>
              <div className="mobile-menu-header">
                <span className="mobile-menu-title">Menu</span>
                <button className="mobile-menu-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>

              <div className="mobile-menu-search">
                <input
                  type="text"
                  placeholder="Search products..."
                  className="mobile-search-input"
                  value={search.searchQuery}
                  onChange={e => search.setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && search.searchResults.length > 0) { search.navigateToProduct(search.searchResults[0]); setMobileMenuOpen(false); } }}
                />
              </div>

              {search.searchQuery.trim().length >= 2 && search.loading ? (
                <p className="mobile-search-loading" aria-live="polite">
                  Searching…
                </p>
              ) : null}
              {search.searchQuery.trim().length >= 2 && !search.loading && search.searchResults.length === 0 ? (
                <p className="mobile-search-empty">No products found</p>
              ) : null}
              {search.searchResults.length > 0 ? (
                <ul className="mobile-search-results">
                  {search.searchResults.map((result) => (
                    <li
                      key={result.slug}
                      onMouseDown={() => {
                        search.navigateToProduct(result);
                        setMobileMenuOpen(false);
                      }}
                      className="mobile-search-result-item"
                    >
                      <span>{result.name}</span>
                      <span className="mobile-result-category">
                        {[result.category, result.brand].filter(Boolean).join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <ul className="mobile-nav-links">
                <li><Link href="/" className="mobile-nav-link">Home</Link></li>
                <li>
                  <button className="mobile-nav-link mobile-cat-toggle" onClick={() => setMobileCatOpen(o => !o)}>
                    Category
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: mobileCatOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path d="m6 9 6 6 6-6"/></svg>
                  </button>
                  {mobileCatOpen && (
                    <div className="mobile-cat-list">
                      {navCategories.map((cat) => (
                        <Link
                          key={cat._id}
                          href={`/category/${cat.slug}`}
                          className="mobile-cat-link"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          {cat.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </li>
                <li><Link href="/about" className="mobile-nav-link">About Us</Link></li>
                <li><Link href="/blogs" className="mobile-nav-link">Blogs</Link></li>
                <li><Link href="/contact" className="mobile-nav-link">Contact Us</Link></li>
                <li><Link href="/cart" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                  Cart {cartCount > 0 && <span className="mobile-cart-badge">{cartCount}</span>}
                </Link></li>
              </ul>
            </nav>
          </div>
        )}

        <StorefrontProductSearchView {...search} />
      </div>
    </header>
  );
};

export default Header;
