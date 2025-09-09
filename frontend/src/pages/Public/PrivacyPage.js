import React from 'react';
import {
  Box,
  Container,
  Typography,
  Divider,
  Link,
} from '@mui/material';
import PublicLayout from '../../layouts/PublicLayout';

const PrivacyPage = () => {
  const sections = [
    {
      title: '1. Information We Collect',
      content: [
        {
          subtitle: '1.1 Information You Provide',
          text: 'We collect information you provide directly to us, such as when you create an account, upload videos, or contact us. This may include your name, email address, password, company information, and any video content you upload.'
        },
        {
          subtitle: '1.2 Automatically Collected Information',
          text: 'When you use ProcessLink, we automatically collect certain information about your device and usage patterns, including IP address, browser type, operating system, referring URLs, and activity on our platform.'
        },
        {
          subtitle: '1.3 Video Content',
          text: 'We process the video content you upload solely for the purpose of providing our transcription and analysis services. Your video content remains your property and is not shared with third parties.'
        }
      ]
    },
    {
      title: '2. How We Use Your Information',
      content: [
        {
          subtitle: '2.1 Service Provision',
          text: 'We use your information to provide, maintain, and improve our services, including video transcription, AI analysis, and knowledge management features.'
        },
        {
          subtitle: '2.2 Communication',
          text: 'We may use your email address to send you service-related notices, updates about new features, and respond to your inquiries.'
        },
        {
          subtitle: '2.3 Analytics and Improvement',
          text: 'We analyze usage patterns to improve our platform, develop new features, and ensure the security and reliability of our services.'
        }
      ]
    },
    {
      title: '3. Data Security',
      content: [
        {
          subtitle: '3.1 Encryption',
          text: 'All data transmitted to and from Process Mind is encrypted using industry-standard SSL/TLS protocols. Your video content and transcripts are encrypted at rest.'
        },
        {
          subtitle: '3.2 Access Controls',
          text: 'We implement strict access controls and authentication mechanisms to ensure only authorized personnel can access user data, and only when necessary for service provision.'
        },
        {
          subtitle: '3.3 Data Centers',
          text: 'Our data is stored in secure, SOC 2 compliant data centers with 24/7 monitoring, redundant backups, and disaster recovery procedures.'
        }
      ]
    },
    {
      title: '4. Data Sharing and Disclosure',
      content: [
        {
          subtitle: '4.1 No Selling of Data',
          text: 'We do not sell, rent, or trade your personal information or video content to third parties.'
        },
        {
          subtitle: '4.2 Service Providers',
          text: 'We may share information with trusted third-party service providers who assist us in operating our platform, such as cloud storage providers (AWS) and AI services (OpenAI), under strict confidentiality agreements.'
        },
        {
          subtitle: '4.3 Legal Requirements',
          text: 'We may disclose information if required by law, court order, or governmental authority, or if we believe disclosure is necessary to protect rights, property, or safety.'
        }
      ]
    },
    {
      title: '5. Your Rights and Choices',
      content: [
        {
          subtitle: '5.1 Access and Update',
          text: 'You can access and update your account information at any time through your account settings.'
        },
        {
          subtitle: '5.2 Data Export',
          text: 'You can export your transcripts and data at any time through our export features.'
        },
        {
          subtitle: '5.3 Account Deletion',
          text: 'You may request deletion of your account and all associated data by contacting our support team. We will delete your data within 30 days of your request.'
        },
        {
          subtitle: '5.4 Data Portability',
          text: 'We provide tools to export your data in common formats, ensuring you can take your content with you.'
        }
      ]
    },
    {
      title: '6. Data Retention',
      content: [
        {
          text: 'We retain your account information for as long as your account is active. Video content and transcripts are retained according to your subscription plan. After account deletion, we may retain certain information as required by law or for legitimate business purposes.'
        }
      ]
    },
    {
      title: '7. International Data Transfers',
      content: [
        {
          text: 'Your information may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place to protect your information in accordance with this privacy policy.'
        }
      ]
    },
    {
      title: '8. Children\'s Privacy',
      content: [
        {
          text: 'ProcessLink is not intended for users under the age of 18. We do not knowingly collect personal information from children under 18.'
        }
      ]
    },
    {
      title: '9. Changes to This Policy',
      content: [
        {
          text: 'We may update this privacy policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last Updated" date.'
        }
      ]
    },
    {
      title: '10. Contact Us',
      content: [
        {
          text: 'If you have any questions about this privacy policy or our data practices, please contact us at:'
        },
        {
          text: 'Email: privacy@processlink.ai\nAddress: ProcessLink, Inc.\n[Your Address]\n[City, State, ZIP]'
        }
      ]
    }
  ];

  return (
    <PublicLayout>
      {/* Header */}
      <Box sx={{ py: 8, backgroundColor: 'background.default' }}>
        <Container maxWidth="lg">
          <Typography
            variant="h1"
            align="center"
            sx={{
              fontWeight: 700,
              fontSize: { xs: '2.5rem', md: '3.5rem' },
              mb: 3,
              background: 'linear-gradient(45deg, #7c3aed 30%, #a855f7 90%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Privacy Policy
          </Typography>
          <Typography
            variant="h6"
            align="center"
            color="text.secondary"
            sx={{ mb: 4 }}
          >
            Last Updated: December 2024
          </Typography>
          <Typography
            variant="body1"
            align="center"
            color="text.secondary"
            sx={{ maxWidth: '800px', mx: 'auto' }}
          >
            At ProcessLink, we take your privacy seriously. This policy describes how we collect, 
            use, and protect your information when you use our services.
          </Typography>
        </Container>
      </Box>

      {/* Content */}
      <Box sx={{ py: 8, backgroundColor: 'background.paper' }}>
        <Container maxWidth="md">
          {sections.map((section, index) => (
            <Box key={index} sx={{ mb: 6 }}>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 600,
                  mb: 3,
                  color: 'primary.main',
                }}
              >
                {section.title}
              </Typography>
              {section.content.map((item, itemIndex) => (
                <Box key={itemIndex} sx={{ mb: 3 }}>
                  {item.subtitle && (
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 600,
                        mb: 1,
                      }}
                    >
                      {item.subtitle}
                    </Typography>
                  )}
                  {item.text && (
                    <Typography
                      variant="body1"
                      color="text.secondary"
                      sx={{
                        lineHeight: 1.8,
                        whiteSpace: 'pre-line',
                      }}
                    >
                      {item.text}
                    </Typography>
                  )}
                </Box>
              ))}
              {index < sections.length - 1 && (
                <Divider sx={{ mt: 4 }} />
              )}
            </Box>
          ))}

          {/* Footer Note */}
          <Box
            sx={{
              mt: 8,
              p: 4,
              backgroundColor: 'background.default',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Your Privacy Matters
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              If you have any questions or concerns about our privacy practices, please don't hesitate to 
              contact us. We're committed to protecting your data and maintaining your trust.
            </Typography>
            <Link
              href="/contact"
              sx={{
                color: 'primary.main',
                textDecoration: 'none',
                fontWeight: 500,
                '&:hover': {
                  textDecoration: 'underline',
                },
              }}
            >
              Contact Our Privacy Team →
            </Link>
          </Box>
        </Container>
      </Box>
    </PublicLayout>
  );
};

export default PrivacyPage;