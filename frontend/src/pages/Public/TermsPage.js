import React from 'react';
import {
  Box,
  Container,
  Typography,
  Divider,
  Link,
} from '@mui/material';
import PublicLayout from '../../layouts/PublicLayout';

const TermsPage = () => {
  const sections = [
    {
      title: '1. Acceptance of Terms',
      content: [
        {
          text: 'By accessing or using ProcessLink ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you do not have permission to access the Service.'
        }
      ]
    },
    {
      title: '2. Description of Service',
      content: [
        {
          text: 'ProcessLink is a SaaS platform that provides AI-powered video transcription, analysis, and knowledge management services. The Service includes video upload, processing, transcription using AI technology, automatic tagging, todo extraction, and visualization features.'
        }
      ]
    },
    {
      title: '3. User Accounts',
      content: [
        {
          subtitle: '3.1 Account Creation',
          text: 'To use certain features of the Service, you must register for an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate, current, and complete.'
        },
        {
          subtitle: '3.2 Account Security',
          text: 'You are responsible for safeguarding the password and for all activities that occur under your account. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.'
        },
        {
          subtitle: '3.3 Account Termination',
          text: 'You may terminate your account at any time. We reserve the right to suspend or terminate your account if you violate these Terms or for any other reason at our sole discretion.'
        }
      ]
    },
    {
      title: '4. User Content',
      content: [
        {
          subtitle: '4.1 Your Content',
          text: 'You retain all rights to the video content and other materials you upload to the Service ("User Content"). By uploading User Content, you grant ProcessLink a limited, non-exclusive license to process, store, and display your content solely for the purpose of providing the Service.'
        },
        {
          subtitle: '4.2 Content Restrictions',
          text: 'You agree not to upload content that: (a) infringes any copyright, trademark, or other proprietary rights; (b) contains any defamatory, obscene, or unlawful material; (c) contains viruses or malicious code; (d) violates any applicable laws or regulations.'
        },
        {
          subtitle: '4.3 Content Removal',
          text: 'We reserve the right to remove any User Content that violates these Terms or for any other reason at our discretion.'
        }
      ]
    },
    {
      title: '5. Acceptable Use',
      content: [
        {
          text: 'You agree not to: (a) use the Service for any unlawful purpose; (b) attempt to interfere with or disrupt the Service; (c) attempt to access another user\'s account; (d) use automated scripts to collect information from the Service; (e) reverse engineer any aspect of the Service; (f) resell or redistribute the Service without our permission.'
        }
      ]
    },
    {
      title: '6. Payment and Billing',
      content: [
        {
          subtitle: '6.1 Subscription Plans',
          text: 'The Service is offered under various subscription plans. You agree to pay all fees associated with your selected plan.'
        },
        {
          subtitle: '6.2 Payment Processing',
          text: 'Payments are processed through third-party payment processors. By providing payment information, you authorize us to charge the applicable fees to your payment method.'
        },
        {
          subtitle: '6.3 Refunds',
          text: 'Subscription fees are non-refundable except as required by law or as explicitly stated in our refund policy.'
        },
        {
          subtitle: '6.4 Price Changes',
          text: 'We reserve the right to change our prices. We will provide advance notice of any price increases affecting your subscription.'
        }
      ]
    },
    {
      title: '7. Intellectual Property',
      content: [
        {
          subtitle: '7.1 Our Property',
          text: 'The Service and its original content (excluding User Content), features, and functionality are owned by ProcessLink and are protected by international copyright, trademark, and other intellectual property laws.'
        },
        {
          subtitle: '7.2 Feedback',
          text: 'Any feedback, suggestions, or ideas you provide about the Service may be used by us without any obligation to compensate you.'
        }
      ]
    },
    {
      title: '8. Privacy',
      content: [
        {
          text: 'Your use of the Service is also governed by our Privacy Policy, which is incorporated into these Terms by reference. Please review our Privacy Policy to understand our practices.'
        }
      ]
    },
    {
      title: '9. Third-Party Services',
      content: [
        {
          text: 'The Service may contain links to third-party websites or services that are not owned or controlled by ProcessLink. We have no control over and assume no responsibility for the content, privacy policies, or practices of any third-party websites or services.'
        }
      ]
    },
    {
      title: '10. Disclaimers',
      content: [
        {
          subtitle: '10.1 "As Is" Service',
          text: 'The Service is provided on an "as is" and "as available" basis. We expressly disclaim all warranties of any kind, whether express or implied, including but not limited to the implied warranties of merchantability, fitness for a particular purpose, and non-infringement.'
        },
        {
          subtitle: '10.2 No Guarantee',
          text: 'We do not guarantee that the Service will be uninterrupted, timely, secure, or error-free, or that defects will be corrected.'
        }
      ]
    },
    {
      title: '11. Limitation of Liability',
      content: [
        {
          text: 'In no event shall ProcessLink, its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your use of the Service.'
        }
      ]
    },
    {
      title: '12. Indemnification',
      content: [
        {
          text: 'You agree to defend, indemnify, and hold harmless ProcessLink and its affiliates from and against any claims, liabilities, damages, judgments, awards, losses, costs, expenses, or fees arising out of or relating to your violation of these Terms or your use of the Service.'
        }
      ]
    },
    {
      title: '13. Governing Law',
      content: [
        {
          text: 'These Terms shall be governed and construed in accordance with the laws of [Your Jurisdiction], without regard to its conflict of law provisions. Any legal action or proceeding shall be brought exclusively in the courts located in [Your Jurisdiction].'
        }
      ]
    },
    {
      title: '14. Changes to Terms',
      content: [
        {
          text: 'We reserve the right to modify these Terms at any time. If we make material changes, we will notify you by email or by posting a notice on the Service. Your continued use of the Service after any such changes constitutes your acceptance of the new Terms.'
        }
      ]
    },
    {
      title: '15. Severability',
      content: [
        {
          text: 'If any provision of these Terms is held to be unenforceable or invalid, such provision will be changed and interpreted to accomplish the objectives of such provision to the greatest extent possible under applicable law, and the remaining provisions will continue in full force and effect.'
        }
      ]
    },
    {
      title: '16. Entire Agreement',
      content: [
        {
          text: 'These Terms constitute the entire agreement between you and ProcessLink regarding the use of the Service, superseding any prior agreements between you and ProcessLink relating to the Service.'
        }
      ]
    },
    {
      title: '17. Contact Information',
      content: [
        {
          text: 'If you have any questions about these Terms, please contact us at:'
        },
        {
          text: 'Email: legal@processlink.ai\nAddress: ProcessLink, Inc.\n[Your Address]\n[City, State, ZIP]'
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
            Terms of Service
          </Typography>
          <Typography
            variant="h6"
            align="center"
            color="text.secondary"
            sx={{ mb: 4 }}
          >
            Effective Date: December 2024
          </Typography>
          <Typography
            variant="body1"
            align="center"
            color="text.secondary"
            sx={{ maxWidth: '800px', mx: 'auto' }}
          >
            Please read these Terms of Service carefully before using ProcessLink. 
            These terms govern your use of our platform and services.
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
              Questions About Our Terms?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              If you have any questions or need clarification about our Terms of Service, 
              our team is here to help. We believe in transparency and are happy to explain 
              any aspect of these terms.
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
              Contact Our Legal Team →
            </Link>
          </Box>
        </Container>
      </Box>
    </PublicLayout>
  );
};

export default TermsPage;