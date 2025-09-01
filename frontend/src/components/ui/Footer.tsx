import Link from 'next/link';
import Image from 'next/image';
import { Mail, Phone, Linkedin, Instagram, MessageCircle } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t py-12">
      <div className="container mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Product Column */}
          <div>
            <h3 className="text-sm font-semibold mb-4">Product</h3>
            <ul className="space-y-3">
              <li>
                <a
                  className="text-sm text-muted-foreground/90 hover:text-foreground"
                  href="https://tryvinci.com/#ai-actors"
                >
                  Solutions
                </a>
              </li>
              <li>
                <a
                  className="text-sm text-muted-foreground/90 hover:text-foreground"
                  href="https://tryvinci.com/#pricing"
                >
                  Pricing
                </a>
              </li>
              <li>
                <Link
                  href="https://tryvinci.com/clips"
                  className="text-sm text-muted-foreground/90 hover:text-foreground"
                >
                  Clips
                </Link>
              </li>
              <li>
                <Link
                  href="https://tryvinci.com/curated"
                  className="text-sm text-muted-foreground/90 hover:text-foreground"
                >
                  Curated
                </Link>
              </li>
              <li>
                <Link
                  href="https://tryvinci.com/brand-custodian"
                  className="text-sm text-muted-foreground/90 hover:text-foreground"
                >
                  Brand Custodian
                </Link>
              </li>
            </ul>
          </div>

          {/* Compare Column */}
          <div>
            <h4 className="text-sm font-semibold mb-4">Compare</h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href="https://tryvinci.com/compare"
                  className="text-sm text-muted-foreground/90 hover:text-foreground"
                >
                  All Platforms
                </Link>
              </li>
              <li>
                <Link
                  href="https://tryvinci.com/compare/heygen"
                  className="text-sm text-muted-foreground/90 hover:text-foreground"
                >
                  vs HeyGen
                </Link>
              </li>
              <li>
                <Link
                  href="https://tryvinci.com/compare/synthesia"
                  className="text-sm text-muted-foreground/90 hover:text-foreground"
                >
                  vs Synthesia
                </Link>
              </li>
              <li>
                <Link
                  href="https://tryvinci.com/compare/d-id"
                  className="text-sm text-muted-foreground/90 hover:text-foreground"
                >
                  vs D-ID
                </Link>
              </li>
              <li>
                <Link
                  href="https://tryvinci.com/compare/runway"
                  className="text-sm text-muted-foreground/90 hover:text-foreground"
                >
                  vs Runway
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Column */}
          <div>
            <h4 className="text-sm font-semibold mb-4">Legal</h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href="https://tryvinci.com/privacy"
                  className="text-sm text-muted-foreground/90 hover:text-foreground"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="https://tryvinci.com/terms"
                  className="text-sm text-muted-foreground/90 hover:text-foreground"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="https://tryvinci.com/refund"
                  className="text-sm text-muted-foreground/90 hover:text-foreground"
                >
                  Refund Policy
                </Link>
              </li>
              <li>
                <Link
                  href="https://tryvinci.com/delivery"
                  className="text-sm text-muted-foreground/90 hover:text-foreground"
                >
                  Delivery Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Column */}
          <div>
            <h4 className="text-sm font-semibold mb-4">Contact</h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="mailto:team@tryvinci.com"
                  className="flex items-center text-sm text-muted-foreground hover:text-foreground"
                >
                  <Mail className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span>team@tryvinci.com</span>
                </a>
              </li>
              <li>
                <a
                  href="tel:+13049181787"
                  className="flex items-center text-sm text-muted-foreground hover:text-foreground"
                >
                  <Phone className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span>+1 304 918 1787</span>
                </a>
              </li>
              <li>
                <a
                  href="https://www.linkedin.com/company/tryvinci"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-sm text-muted-foreground hover:text-foreground"
                >
                  <Linkedin className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span>LinkedIn</span>
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/try.vinci"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-sm text-muted-foreground hover:text-foreground"
                >
                  <Instagram className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span>Instagram</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Community Column */}
          <div>
            <h4 className="text-sm font-semibold mb-4">Community</h4>
            <p className="text-sm text-muted-foreground/90 mb-4">
              Join our active communities to connect, learn, and grow.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <a
                  href="https://tryvinci.com/discord"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Join Discord"
                >
                  <Image src="/discord.svg" alt="Discord" width={32} height={32} />
                </a>
                <a
                  href="https://tryvinci.com/discord"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Discord
                </a>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href="https://tryvinci.com/whatsapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Join WhatsApp"
                >
                  <MessageCircle className="h-8 w-8" />
                </a>
                <a
                  href="https://tryvinci.com/whatsapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between pt-8 border-t gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Link href="https://tryvinci.com" className="flex items-center">
              <Image
                src="/logo.png"
                alt="Vinci"
                width={180}
                height={48}
                className="hidden dark:block"
              />
              <Image
                src="/logo-name-light.png"
                alt="Vinci"
                width={180}
                height={48}
                className="block dark:hidden"
              />
            </Link>
            <span className="text-sm text-muted-foreground">
              Webinci Tech Pvt Ltd © All Rights Reserved.
            </span>
          </div>
          <div className="flex flex-col items-start md:items-end gap-2">
            <h5 className="text-sm font-semibold text-muted-foreground">AI Resources</h5>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
                Sitemap
              </a>
              <a href="/llms.txt" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
                llms.txt
              </a>
              <a href="/llms-full.txt" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
                llms-full.txt
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
