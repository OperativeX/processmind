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
      title: '1. Informationen, die wir erfassen',
      content: [
        {
          subtitle: '1.1 Von Ihnen bereitgestellte Informationen',
          text: 'Wir erfassen Informationen, die Sie uns direkt zur Verfügung stellen, z.B. wenn Sie ein Konto erstellen, Videos hochladen oder uns kontaktieren. Dies kann Ihren Namen, E-Mail-Adresse, Passwort, Unternehmensinformationen und alle von Ihnen hochgeladenen Videoinhalte umfassen.'
        },
        {
          subtitle: '1.2 Automatisch erfasste Informationen',
          text: 'Wenn Sie ProcessLink nutzen, erfassen wir automatisch bestimmte Informationen über Ihr Gerät und Ihre Nutzungsmuster, einschließlich IP-Adresse, Browsertyp, Betriebssystem, verweisende URLs und Aktivitäten auf unserer Plattform.'
        },
        {
          subtitle: '1.3 Videoinhalte',
          text: 'Wir verarbeiten die von Ihnen hochgeladenen Videoinhalte ausschließlich zum Zweck der Bereitstellung unserer Transkriptions- und Analysedienste. Ihre Videoinhalte bleiben Ihr Eigentum und werden nicht an Dritte weitergegeben.'
        }
      ]
    },
    {
      title: '2. Wie wir Ihre Informationen nutzen',
      content: [
        {
          subtitle: '2.1 Bereitstellung von Diensten',
          text: 'Wir nutzen Ihre Informationen zur Bereitstellung, Wartung und Verbesserung unserer Dienste, einschließlich Videotranskription, KI-Analyse und Wissensmanagement-Funktionen.'
        },
        {
          subtitle: '2.2 Kommunikation',
          text: 'Wir können Ihre E-Mail-Adresse verwenden, um Ihnen dienstbezogene Benachrichtigungen, Updates über neue Funktionen zu senden und auf Ihre Anfragen zu antworten.'
        },
        {
          subtitle: '2.3 Analysen und Verbesserungen',
          text: 'Wir analysieren Nutzungsmuster, um unsere Plattform zu verbessern, neue Funktionen zu entwickeln und die Sicherheit und Zuverlässigkeit unserer Dienste zu gewährleisten.'
        }
      ]
    },
    {
      title: '3. Datensicherheit',
      content: [
        {
          subtitle: '3.1 Verschlüsselung',
          text: 'Alle Daten, die zu und von ProcessLink übertragen werden, sind mit branchenstandard SSL/TLS-Protokollen verschlüsselt. Ihre Videoinhalte und Transkripte werden im Ruhezustand verschlüsselt.'
        },
        {
          subtitle: '3.2 Zugangskontrollen',
          text: 'Wir implementieren strenge Zugangskontrollen und Authentifizierungsmechanismen, um sicherzustellen, dass nur autorisiertes Personal auf Benutzerdaten zugreifen kann, und nur wenn dies für die Dienstleistungserbringung erforderlich ist.'
        },
        {
          subtitle: '3.3 Rechenzentren',
          text: 'Unsere Daten werden in sicheren, SOC 2-konformen Rechenzentren mit 24/7-Überwachung, redundanten Backups und Disaster-Recovery-Verfahren gespeichert.'
        }
      ]
    },
    {
      title: '4. Datenweitergabe und Offenlegung',
      content: [
        {
          subtitle: '4.1 Kein Verkauf von Daten',
          text: 'Wir verkaufen, vermieten oder handeln nicht mit Ihren persönlichen Informationen oder Videoinhalten an Dritte.'
        },
        {
          subtitle: '4.2 Dienstleister',
          text: 'Wir können Informationen mit vertrauenswürdigen Drittanbietern teilen, die uns beim Betrieb unserer Plattform unterstützen, wie Cloud-Speicher-Anbieter (AWS) und KI-Dienste (OpenAI), unter strengen Vertraulichkeitsvereinbarungen.'
        },
        {
          subtitle: '4.3 Rechtliche Anforderungen',
          text: 'Wir können Informationen offenlegen, wenn dies gesetzlich, per Gerichtsbeschluss oder behördlich vorgeschrieben ist, oder wenn wir glauben, dass die Offenlegung zum Schutz von Rechten, Eigentum oder Sicherheit erforderlich ist.'
        }
      ]
    },
    {
      title: '5. Ihre Rechte und Wahlmöglichkeiten',
      content: [
        {
          subtitle: '5.1 Zugriff und Aktualisierung',
          text: 'Sie können jederzeit auf Ihre Kontoinformationen zugreifen und diese über Ihre Kontoeinstellungen aktualisieren.'
        },
        {
          subtitle: '5.2 Datenexport',
          text: 'Sie können Ihre Transkripte und Daten jederzeit über unsere Exportfunktionen exportieren.'
        },
        {
          subtitle: '5.3 Kontolöschung',
          text: 'Sie können die Löschung Ihres Kontos und aller damit verbundenen Daten beantragen, indem Sie unser Support-Team kontaktieren. Wir werden Ihre Daten innerhalb von 30 Tagen nach Ihrer Anfrage löschen.'
        },
        {
          subtitle: '5.4 Datenportabilität',
          text: 'Wir bieten Tools zum Export Ihrer Daten in gängigen Formaten, damit Sie Ihre Inhalte mitnehmen können.'
        }
      ]
    },
    {
      title: '6. Datenspeicherung',
      content: [
        {
          text: 'Wir speichern Ihre Kontoinformationen so lange, wie Ihr Konto aktiv ist. Videoinhalte und Transkripte werden gemäß Ihrem Abonnementplan gespeichert. Nach der Kontolöschung können wir bestimmte Informationen aufbewahren, soweit dies gesetzlich vorgeschrieben ist oder für legitime Geschäftszwecke erforderlich ist.'
        }
      ]
    },
    {
      title: '7. Internationale Datenübertragungen',
      content: [
        {
          text: 'Ihre Informationen können in andere Länder als Ihr Wohnsitzland übertragen und dort verarbeitet werden. Wir stellen sicher, dass angemessene Schutzmaßnahmen zum Schutz Ihrer Informationen gemäß dieser Datenschutzrichtlinie vorhanden sind.'
        }
      ]
    },
    {
      title: '8. Datenschutz für Kinder',
      content: [
        {
          text: 'ProcessLink ist nicht für Nutzer unter 18 Jahren bestimmt. Wir erfassen wissentlich keine persönlichen Informationen von Kindern unter 18 Jahren.'
        }
      ]
    },
    {
      title: '9. Änderungen dieser Richtlinie',
      content: [
        {
          text: 'Wir können diese Datenschutzrichtlinie von Zeit zu Zeit aktualisieren. Wir werden Sie über wesentliche Änderungen informieren, indem wir die neue Richtlinie auf dieser Seite veröffentlichen und das "Zuletzt aktualisiert"-Datum aktualisieren.'
        }
      ]
    },
    {
      title: '10. Kontakt',
      content: [
        {
          text: 'Wenn Sie Fragen zu dieser Datenschutzrichtlinie oder unseren Datenpraktiken haben, kontaktieren Sie uns bitte unter:'
        },
        {
          text: 'E-Mail: datenschutz@processlink.de\nAdresse: ProcessLink GmbH\n[Ihre Adresse]\n[Stadt, PLZ]'
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
            Datenschutzerklärung
          </Typography>
          <Typography
            variant="h6"
            align="center"
            color="text.secondary"
            sx={{ mb: 4 }}
          >
            Zuletzt aktualisiert: Dezember 2024
          </Typography>
          <Typography
            variant="body1"
            align="center"
            color="text.secondary"
            sx={{ maxWidth: '800px', mx: 'auto' }}
          >
            Bei ProcessLink nehmen wir Ihren Datenschutz ernst. Diese Richtlinie beschreibt, wie wir Ihre 
            Informationen erfassen, nutzen und schützen, wenn Sie unsere Dienste nutzen.
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
              Ihr Datenschutz ist uns wichtig
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Wenn Sie Fragen oder Bedenken zu unseren Datenschutzpraktiken haben, zögern Sie bitte nicht, 
              uns zu kontaktieren. Wir sind dem Schutz Ihrer Daten und der Wahrung Ihres Vertrauens verpflichtet.
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
              Datenschutzteam kontaktieren →
            </Link>
          </Box>
        </Container>
      </Box>
    </PublicLayout>
  );
};

export default PrivacyPage;