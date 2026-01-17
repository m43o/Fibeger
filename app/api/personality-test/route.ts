import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '@/app/lib/prisma';
import personalityTestData from '@/app/lib/personalityTest.json';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { answers } = await req.json();

    if (!answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: 'Invalid answers format' }, { status: 400 });
    }

    // Calculate scores for each badge type
    const scores: Record<string, number> = {};

    answers.forEach((answerIndex: number, questionIndex: number) => {
      const question = personalityTestData.questions[questionIndex];
      if (!question) return;

      const answer = question.answers[answerIndex];
      if (!answer) return;

      // Add weights to scores
      Object.entries(answer.weights).forEach(([badgeId, weight]) => {
        scores[badgeId] = (scores[badgeId] || 0) + weight;
      });
    });

    // Find the badge with the highest score
    let highestScore = 0;
    let winningBadgeId = 'dreamer'; // Default fallback

    Object.entries(scores).forEach(([badgeId, score]) => {
      if (score > highestScore) {
        highestScore = score;
        winningBadgeId = badgeId;
      }
    });

    // Update user's personality badge
    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: { personalityBadge: winningBadgeId },
    });

    // Find the badge details
    const badge = personalityTestData.badges.find((b) => b.id === winningBadgeId);

    return NextResponse.json({
      success: true,
      badge: badge,
      scores: scores,
    });
  } catch (error) {
    console.error('Personality test error:', error);
    return NextResponse.json(
      { error: 'Failed to process test results' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Return the test configuration
    return NextResponse.json(personalityTestData);
  } catch (error) {
    console.error('Error fetching personality test:', error);
    return NextResponse.json(
      { error: 'Failed to fetch test' },
      { status: 500 }
    );
  }
}
